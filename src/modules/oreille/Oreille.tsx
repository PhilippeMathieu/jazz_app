// Oreille : reconnaître une qualité d'accord, une progression, construire un accord.
import { useEffect, useRef, useState } from 'preact/hooks';
import { QUALITIES, chordNotes, chordSymbol, rootPc, spellInChord } from '../../core/theory/chords';
import { mod, noteName, plainName } from '../../core/theory/notes';
import { PROGRESSIONS, romanLine } from '../../core/theory/progressions';
import { audio, now, piano, playChord, silence } from '../../core/audio/engine';
import { load, save } from '../../core/storage';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { StatBars } from '../../ui/StatBars';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { PlayIcon } from '../../ui/icons';
import { notesMarks } from '../../ui/keyboardMarks';
import { HINTS, LEVEL_LABELS, PROG_LEVELS, QUALITY_LEVELS } from './data';
import { EarMode, EarQuestion, Tally, checkBuild, makeEarQuestion } from './questions';

interface Stats {
  mode: EarMode;
  lv: Record<EarMode, number>;
  items: Tally;
  recent: Record<string, number[]>;
}
const DEFAULT: Stats = { mode: 'ear', lv: { ear: 1, prog: 1, build: 1 }, items: {}, recent: {} };
const PROMPT: Record<EarMode, string> = { ear: 'Quel accord ?', prog: 'Quelle progression ?', build: 'Construis cet accord' };
const clampLv = (n: number) => (n >= 1 && n <= 4 ? n : 1);

export function Oreille() {
  const [stats, setStats] = useState<Stats>(() => load('oreille', DEFAULT));
  const mode = stats.mode;
  const level = clampLv(stats.lv[mode]);
  const last = useRef<string | undefined>(undefined);
  const [q, setQ] = useState<EarQuestion>(() => makeEarQuestion(mode, level, stats.items));
  const [answer, setAnswer] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [lit, setLit] = useState(-1);
  const [shown, setShown] = useState(0);
  const [session, setSession] = useState({ c: 0, t: 0, streak: 0 });
  const timers = useRef<number[]>([]);
  useEffect(() => save('oreille', stats), [stats]);
  useEffect(() => () => stop(), []);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    silence();
    setLit(-1);
  };
  const play = (qq: EarQuestion = q, arp = false) => {
    audio();
    stop();
    const t0 = now() + 0.06;
    if (qq.mode === 'ear') {
      if (arp) qq.c.notes.forEach((m, i) => piano(m, t0 + i * 0.16, 2.2, 0.55));
      else playChord(qq.c.notes, t0, 2.2, 0.6);
    } else if (qq.mode === 'prog') {
      const step = 1.6;
      qq.chords.forEach((c, i) => {
        playChord(c.notes, t0 + i * step, step - 0.1, 0.6);
        timers.current.push(window.setTimeout(() => setLit(i), i * step * 1000 + 60));
      });
      timers.current.push(window.setTimeout(() => setLit(-1), qq.chords.length * step * 1000));
    }
  };
  const fresh = (m: EarMode, l: number, autoplay: boolean) => {
    stop();
    const nq = makeEarQuestion(m, l, stats.items, last.current);
    last.current = nq.mode === 'prog' ? nq.id : nq.q;
    setQ(nq);
    setAnswer(null);
    setOk(null);
    setSel([]);
    setShown(0);
    if (autoplay) play(nq);
  };
  const record = (item: string, good: boolean) => {
    setStats((s) => {
      const it = s.items[item] ?? { c: 0, t: 0 };
      const rk = s.mode + clampLv(s.lv[s.mode]);
      return {
        ...s,
        items: { ...s.items, [item]: { c: it.c + (good ? 1 : 0), t: it.t + 1 } },
        recent: { ...s.recent, [rk]: [...(s.recent[rk] ?? []), good ? 1 : 0].slice(-10) }
      };
    });
    setSession((x) => ({ c: x.c + (good ? 1 : 0), t: x.t + 1, streak: good ? x.streak + 1 : 0 }));
  };
  const choose = (a: string) => {
    if (answer !== null || q.mode === 'build') return;
    const good = q.mode === 'ear' ? a === q.q : a === q.id;
    setAnswer(a);
    setOk(good);
    record(q.mode === 'ear' ? 'ear:' + q.q : 'prog:' + q.id, good);
    play(q);
  };
  const validate = () => {
    if (q.mode !== 'build') return;
    const r = checkBuild(q.c.chord, sel);
    setAnswer('build');
    setOk(r.ok);
    record('build:' + q.q, r.ok);
    audio();
    stop();
    playChord(target(), now() + 0.05, 2.2, 0.6);
  };
  const target = () => {
    if (q.mode !== 'build') return [];
    const r = 60 + rootPc(q.c.chord);
    return QUALITIES[q.q].iv.map((i) => {
      let x = r + i;
      while (x > 76) x -= 12;
      return x;
    });
  };
  const setMode = (m: EarMode) => {
    if (m === mode) return;
    setStats((s) => ({ ...s, mode: m }));
    fresh(m, clampLv(stats.lv[m]), false);
  };
  const setLevel = (l: number) => {
    setStats((s) => ({ ...s, lv: { ...s.lv, [mode]: l } }));
    fresh(mode, l, false);
  };

  const answered = answer !== null;
  const recent = stats.recent[mode + level] ?? [];
  const recentScore = recent.reduce((x, y) => x + y, 0);
  const pool = mode === 'prog' ? PROG_LEVELS[level - 1] : QUALITY_LEVELS[level - 1];

  // Clavier
  let kb = null;
  if (q.mode === 'build') {
    let marks: Record<number, Mark> = {};
    let labels: Record<number, string> = {};
    if (!answered) sel.forEach((m) => ((marks[m] = 'sel'), (labels[m] = plainName(m))));
    else {
      const r = checkBuild(q.c.chord, sel);
      sel.forEach((m) => {
        marks[m] = r.extra.includes(mod(m, 12)) ? 'bad' : 'ok';
        labels[m] = spellInChord(q.c.chord, m);
      });
      for (const p of r.missing) {
        const m = 60 + p;
        marks[m] = 'miss';
        labels[m] = spellInChord(q.c.chord, m);
      }
    }
    kb = (
      <Keyboard
        lo={60}
        hi={71}
        marks={marks}
        labels={labels}
        big
        onKey={
          answered
            ? undefined
            : (m) => {
                audio();
                if (sel.includes(m)) setSel(sel.filter((x) => x !== m));
                else {
                  setSel([...sel, m]);
                  piano(m, now() + 0.01, 1.2, 0.5);
                }
              }
        }
      />
    );
  } else if (answered) {
    const pc = q.mode === 'ear' ? q.c : q.chords[Math.max(0, lit >= 0 ? lit : shown)];
    const km = notesMarks(pc.chord, pc.notes);
    kb = <Keyboard lo={36} hi={84} marks={km.marks} labels={km.labels} center={pc.notes} />;
  }

  return (
    <div class="screen play-screen">
      <TopBar
        title="Oreille"
        actions={
          <span class="play-meta">
            {session.c}/{session.t}
            {session.streak > 1 ? ` · ${session.streak} d’affilée` : ''}
          </span>
        }
      />
      <Segmented
        label="Exercice"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'ear', label: 'Accords' },
          { value: 'prog', label: 'Progressions' },
          { value: 'build', label: 'Construire' }
        ]}
      />
      <Segmented label="Niveau" value={level} onChange={setLevel} options={LEVEL_LABELS[mode].map((t, i) => ({ value: i + 1, label: `N${i + 1}`, sub: t }))} />
      {recent.length === 10 && recentScore >= 8 && level < 4 ? (
        <button class="banner ok" onClick={() => setLevel(level + 1)}>
          {recentScore}/10 sur tes dernières réponses : passe au N{level + 1}
        </button>
      ) : null}

      <section class="ear-stage">
        {q.mode === 'build' ? (
          <div class="build-head">
            <span class="target-sym">{chordSymbol(q.c.chord)}</span>
            <span class="muted small">Touche les notes, octave libre.</span>
          </div>
        ) : (
          <div class="playrow">
            <button class="play big-play" aria-label="Écouter" onClick={() => play(q)}>
              <PlayIcon />
            </button>
            {q.mode === 'ear' ? (
              <button class="btn" onClick={() => play(q, true)}>
                Arpège
              </button>
            ) : (
              <div class="dots" aria-hidden="true">
                {q.chords.map((_, i) => <i key={i} class={lit === i ? 'on' : ''} />)}
              </div>
            )}
          </div>
        )}
        <h2 class="prompt">{PROMPT[mode]}</h2>
        {answered ? (
          <div class="fb">
            {q.mode === 'ear' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? `Juste : ${chordSymbol(q.c.chord)}.` : `Non, c’était ${chordSymbol(q.c.chord)}.`}</p>
                <p class="muted">{HINTS[q.q]}</p>
              </>
            ) : q.mode === 'prog' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? `Juste : ${PROGRESSIONS[q.id].name}.` : `Non, c’était : ${PROGRESSIONS[q.id].name}.`}</p>
                <div class="pchips">
                  {q.chords.map((c, i) => (
                    <button
                      key={i}
                      class={'pchip' + ((lit >= 0 ? lit : shown) === i ? ' on' : '')}
                      onClick={() => {
                        audio();
                        stop();
                        setShown(i);
                        playChord(c.notes, now() + 0.05, 2, 0.6);
                      }}
                    >
                      <b>{chordSymbol(c.chord)}</b>
                      <span>{c.roman}</span>
                    </button>
                  ))}
                </div>
                <p class="muted">{PROGRESSIONS[q.id].hint}</p>
              </>
            ) : (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? 'Juste.' : 'Pas tout à fait.'}</p>
                <p class="muted">
                  <span class="mono">{chordNotes(q.c.chord).map(noteName).join(' ')}</span>
                  {QUALITIES[q.q].iv.length >= 5 || q.q === '13' ? ' (quinte facultative)' : ''}. {HINTS[q.q]}
                </p>
              </>
            )}
          </div>
        ) : null}
        {kb}
      </section>

      <div class="thumb-zone">
        {q.mode !== 'build' && !answered ? (
          <div class={'choices' + (mode === 'prog' ? ' long' : '')}>
            {pool.map((k) => (
              <button key={k} class="choice" onClick={() => choose(k)}>
                {mode === 'prog' ? (
                  <>
                    <span>{romanLine(k)}</span>
                    <small>{PROGRESSIONS[k].name}</small>
                  </>
                ) : (
                  <>
                    <span>{QUALITIES[k].sym}</span>
                    <small>{QUALITIES[k].name}</small>
                  </>
                )}
              </button>
            ))}
          </div>
        ) : null}
        {q.mode === 'build' && !answered ? (
          <div class="row-actions">
            <button class="btn" disabled={!sel.length} onClick={() => setSel([])}>
              Effacer
            </button>
            <button class="btn primary" disabled={!sel.length} onClick={validate}>
              Valider
            </button>
          </div>
        ) : null}
        {answered ? (
          <button class="btn primary block" onClick={() => fresh(mode, level, q.mode !== 'build')}>
            Suivant
          </button>
        ) : null}
      </div>

      <section>
        <h2 class="label">Réussite, niveau {level}</h2>
        <StatBars
          rows={pool
            .map((k) => {
              const it = stats.items[mode + ':' + k] ?? { c: 0, t: 0 };
              return { label: mode === 'prog' ? PROGRESSIONS[k].name : QUALITIES[k].sym, c: it.c, t: it.t };
            })
            .sort((a, b) => (a.t ? a.c / a.t : 2) - (b.t ? b.c / b.t : 2))}
        />
        <ConfirmButton label="Remettre les statistiques à zéro" confirm="Toucher encore pour confirmer" onConfirm={() => setStats((s) => ({ ...s, items: {}, recent: {} }))} />
      </section>
    </div>
  );
}
