// Progression : grade, objectif du jour et série, défis, étoiles par exercice, badges, collection de standards.
import { BADGES, EXOS, GRADES, addDaysKey, dayKey, gradeOf, setFx, setGoal, streakOf } from '../../core/game';
import { LIBRARY } from '../../library/charts';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Challenges, GoalRing, useGame } from '../../ui/GameStrip';
import { Stars } from '../../ui/Setup';

const fmt = (n: number) => n.toLocaleString('fr-FR');

export function Progres() {
  const g = useGame();
  const gr = gradeOf(g.xp);
  const today = dayKey();
  const st = streakOf(g, today);
  const min = (g.days[today]?.ms ?? 0) / 60000;
  // Les 21 derniers jours : objectif atteint ou non.
  const last = Array.from({ length: 21 }, (_, i) => addDaysKey(today, i - 20));
  const starsTotal = Object.values(g.stars).reduce((a, b) => a + b, 0);
  const starsMax = Object.values(EXOS).reduce((a, e) => a + e.levels * 3, 0);
  const valid = (id: string) => {
    const s = g.standards[id];
    return !!(s?.analyse && s.guide && s.comp);
  };
  return (
    <div class="screen">
      <TopBar title="Progression" />

      <section class="pg-grade">
        <span class="label">Grade</span>
        <b class="pg-grade-name">{gr.name}</b>
        <span class="gs-bar">
          <i style={`width:${Math.round(gr.progress * 100)}%`} />
        </span>
        <span class="muted small">
          {fmt(g.xp)} points{gr.next ? ` · encore ${fmt(gr.toNext)} pour ${gr.next}` : ' · grade le plus haut'}
        </span>
        <div class="pg-grades">
          {GRADES.map((x, i) => (
            <span key={x.name} class={i <= gr.index ? 'on' : ''}>
              {x.name}
              <small>{fmt(x.xp)}</small>
            </span>
          ))}
        </div>
        <p class="muted small">Points : 2 par bonne réponse, plus au niveau supérieur ; 25 par étoile ; 60 par défi ; 50 pour l’objectif du jour.</p>
      </section>

      <section>
        <h2 class="label">Objectif du jour</h2>
        <div class="pg-goal">
          <GoalRing done={min} goal={g.goalMin} size={64} />
          <div>
            <b>
              {Math.floor(min)} / {g.goalMin} min
            </b>
            <p class="muted small">
              Série : {st.days} jour{st.days > 1 ? 's' : ''} d’affilée{st.jokerUsed ? ' (un joker utilisé)' : ''}. Un jour manqué par semaine ne casse pas la série.
            </p>
          </div>
        </div>
        <div class="pg-days" aria-label="Les 21 derniers jours">
          {last.map((k) => {
            const ms = g.days[k]?.ms ?? 0;
            return <i key={k} class={ms >= g.goalMin * 60000 ? 'full' : ms > 0 ? 'some' : ''} title={k} />;
          })}
        </div>
        <Segmented
          label="Objectif"
          value={g.goalMin}
          onChange={setGoal}
          options={[
            { value: 5, label: '5 min' },
            { value: 10, label: '10 min' },
            { value: 20, label: '20 min' }
          ]}
        />
      </section>

      <Challenges list={g.challenges.list} />

      <section>
        <h2 class="label">
          Étoiles · {starsTotal}/{starsMax}
        </h2>
        <p class="muted small">Sur les 20 dernières réponses d’un niveau : ★ à 60 % (12/20), ★★ à 75 % (15/20), ★★★ à 90 % (18/20). La première étoile ouvre le niveau suivant.</p>
        <div class="pg-stars">
          {Object.entries(EXOS).map(([id, e]) => (
            <a key={id} class="pg-star-row" href={e.href}>
              <span>{e.name}</span>
              <span class="pg-levels">
                {Array.from({ length: e.levels }, (_, i) => {
                  const s = g.stars[`${id}:${i}`] ?? 0;
                  const locked = i > (g.unlocked[id] ?? 0) && !s;
                  return (
                    <span key={i} class={'pg-lv' + (locked ? ' locked' : '')} title={`Niveau ${i + 1}`}>
                      <small>{i + 1}</small>
                      <Stars n={s} />
                    </span>
                  );
                })}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 class="label">
          Badges · {Object.keys(g.badges).length}/{BADGES.length}
        </h2>
        <div class="pg-badges">
          {BADGES.map((b) => {
            const at = g.badges[b.id];
            return (
              <div key={b.id} class={'pg-badge' + (at ? ' on' : '')}>
                <b>{b.name}</b>
                <span>{b.desc}</span>
                {at ? <small>{new Date(at).toLocaleDateString('fr-FR')}</small> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 class="label">
          Collection · {LIBRARY.filter((c) => valid(c.id)).length}/{LIBRARY.length} standards
        </h2>
        <p class="muted small">
          Un standard est validé quand il est analysé à 100 % (Analyser), joué avec les guide tones au micro (80 % au 1er temps) et accompagné au micro (90 % d’accords justes).
        </p>
        <div class="list">
          {LIBRARY.map((c) => {
            const s = g.standards[c.id] ?? {};
            return (
              <a key={c.id} class={'row pg-std' + (valid(c.id) ? ' valid' : '')} href={`#/grille/${c.id}`}>
                <span class="row-main">
                  <span class="row-title">{c.title}</span>
                </span>
                <span class="pg-marks">
                  <i class={s.analyse ? 'on' : ''}>Analyse</i>
                  <i class={s.guide ? 'on' : ''}>Guide</i>
                  <i class={s.comp ? 'on' : ''}>Comping</i>
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <label class="toggle">
        <input type="checkbox" checked={g.fx} onChange={() => setFx(!g.fx)} />
        <span>Petit carillon pour les récompenses</span>
      </label>
    </div>
  );
}
