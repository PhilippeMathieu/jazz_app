// Mode « Analyser » d'une grille : l'élève repère les enchaînements (ii–V–I, dominantes secondaires…),
// les nomme avec leur tonalité, puis l'appli corrige et montre ce qu'il a manqué.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { keyOnPc } from '../../core/chart/model';
import { ImprovPlan } from '../../core/analysis/improv';
import { Correction, Mark, SPOT_LABEL, SPOT_ORDER, SPOT_SUB, Spot, SpotType, correct, findSpots } from '../../core/analysis/spots';
import { chordSymbol } from '../../core/theory/chords';
import { noteName } from '../../core/theory/notes';
import { audio, now, playChord } from '../../core/audio/engine';
import { displayVoicing } from '../../core/audio/voicing';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { Segmented } from '../../ui/Segmented';
import { Field } from '../../ui/Setup';
import { PlayIcon } from '../../ui/icons';
import { ConfirmButton } from '../../ui/ConfirmButton';

interface Saved {
  marks: Mark[];
  checked: boolean;
}

export type Analyser = ReturnType<typeof useAnalyser>;

export function useAnalyser(chartId: string, plan: ImprovPlan, beatsPerBar: number, shift: number) {
  const storeKey = `analyser:${chartId}:${shift}`;
  const [saved, setSaved] = useState<Saved>(() => load(storeKey, { marks: [], checked: false }));
  const [start, setStart] = useState<number | null>(null);
  const [form, setForm] = useState<{ from: number; to: number } | null>(null);
  const [focus, setFocusState] = useState<{ from: number; to: number } | null>(null);
  /** Met un enchaînement en évidence dans la grille, et l'amène à l'écran. */
  const setFocus = (f: { from: number; to: number } | null) => {
    setFocusState(f);
    if (f) document.querySelector(`[data-ci="${f.from}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  useEffect(() => setSaved(load(storeKey, { marks: [], checked: false })), [storeKey]);
  useEffect(() => save(storeKey, saved), [saved]);
  const spots = useMemo(() => findSpots(plan.flat, plan.analysis, beatsPerBar), [plan, beatsPerBar]);
  const result: Correction | null = useMemo(() => (saved.checked ? correct(saved.marks, spots, plan.flat, plan.analysis) : null), [saved, spots, plan]);

  /** Toucher un accord : 1er accord, puis dernier ; un 3e toucher recommence. */
  const tap = (ci: number) => {
    if (saved.checked) return;
    setFocus(null);
    if (start === null || ci < start) return setStart(ci);
    if (ci === start) return setStart(null);
    setForm({ from: start, to: ci });
    setStart(null);
  };
  const add = (type: SpotType, target: number) => {
    if (!form) return;
    setSaved((s) => ({ ...s, marks: [...s.marks.filter((m) => !(m.from === form.from && m.to === form.to)), { ...form, type, target }].sort((a, b) => a.from - b.from) }));
    setForm(null);
  };
  const remove = (m: Mark) => setSaved((s) => ({ ...s, marks: s.marks.filter((x) => x !== m) }));
  const check = () => {
    const r = correct(saved.marks, spots, plan.flat, plan.analysis);
    const q = load('quiz', { c: 0, t: 0 });
    save('quiz', { c: q.c + r.found, t: q.t + r.total });
    report({ type: 'analyse', chart: chartId, found: r.found, total: r.total, bad: r.results.filter((x) => x.verdict === 'bad').length });
    setSaved((s) => ({ ...s, checked: true }));
    setStart(null);
  };
  const reset = () => {
    setSaved({ marks: [], checked: false });
    setFocus(null);
    setStart(null);
  };

  /** Habillage d'un accord : sélection en cours, crochet du repérage, verdict. */
  const decor = (ci: number): { cls: string; bk: string; sub: string; subCls: string } => {
    let cls = '';
    if (start === ci) cls += ' pick';
    if (focus && focus.from <= ci && ci <= focus.to) cls += ' focus';
    const part = (from: number, to: number) => `${ci === from ? ' l' : ''}${ci === to ? ' r' : ''} on`;
    if (!result) {
      const m = saved.marks.find((x) => x.from <= ci && ci <= x.to);
      return { cls, bk: m ? part(m.from, m.to) + ' user' : '', sub: m && m.from === ci ? SPOT_LABEL[m.type] : '', subCls: 'rn' };
    }
    const r = result.results.find((x) => x.mark.from <= ci && ci <= x.mark.to);
    const miss = result.missed.find((s) => s.main && s.from <= ci && ci <= s.to);
    const a = plan.analysis.chords[ci];
    if (r) return { cls, bk: part(r.mark.from, r.mark.to) + ' user ' + r.verdict, sub: a.roman, subCls: 'rn' };
    if (miss) return { cls, bk: part(miss.from, miss.to) + ' missed', sub: a.roman, subCls: 'rn' };
    return { cls, bk: '', sub: a.roman, subCls: 'rn' + (a.diatonic ? '' : ' out') };
  };

  return { saved, start, form, setForm, focus, setFocus, spots, result, tap, add, remove, check, reset, decor };
}

const bars = (plan: ImprovPlan, from: number, to: number) => {
  const x = plan.flat[from].bar + 1;
  const y = plan.flat[to].bar + 1;
  return x === y ? `Mes. ${x}` : `Mes. ${x}–${y}`;
};
const chords = (plan: ImprovPlan, from: number, to: number) =>
  plan.flat
    .slice(from, to + 1)
    .map((f) => chordSymbol(f.chord))
    .filter((s, i, a) => i === 0 || a[i - 1] !== s)
    .join(' ');
const pcName = (pc: number) => noteName(keyOnPc(pc, 'major').tonic);

/** Au-dessus de la grille : la consigne du moment et « Vérifier ». */
export function AnalyserHint({ an, plan }: { an: Analyser; plan: ImprovPlan }) {
  const r = an.result;
  if (r)
    return (
      <div class="an-top">
        <p class={'verdict ' + (r.found === r.total ? 'ok' : 'bad')}>
          Trouvé : {r.found} sur {r.total} enchaînement{r.total > 1 ? 's' : ''}. <span class="muted small">Le détail est sous la grille.</span>
        </p>
        <button class="btn primary" onClick={an.reset}>
          Recommencer l’analyse
        </button>
      </div>
    );
  return (
    <div class="an-top">
      <p class="an-hint">
        {an.start !== null
          ? `Départ : ${chordSymbol(plan.flat[an.start].chord)}. Touche maintenant le dernier accord de l’enchaînement.`
          : an.saved.marks.length
            ? 'Continue : premier accord, puis dernier. Quand tu as fini, vérifie.'
            : 'Repère les enchaînements : touche le premier accord, puis le dernier. Tu diras ensuite ce que c’est.'}
      </p>
      {an.saved.marks.length ? (
        <div class="an-actions">
          <button class="btn primary" onClick={an.check}>
            Vérifier ({an.saved.marks.length})
          </button>
          <ConfirmButton label="Tout effacer" confirm="Effacer les repérages ?" onConfirm={an.reset} />
        </div>
      ) : null}
    </div>
  );
}

/** Sous la grille : ce qu'on a marqué, puis la correction. */
export function AnalyserPanel({ an, plan, onShowDegrees }: { an: Analyser; plan: ImprovPlan; onShowDegrees: () => void }) {
  const r = an.result;
  if (!r) {
    return (
      <section class="an-panel">
        {an.saved.marks.length ? <h2 class="label">Tes repérages</h2> : null}
        {an.saved.marks.length ? (
          <div class="list">
            {an.saved.marks.map((m) => (
              <div key={`${m.from}-${m.to}`} class="row an-row">
                <span class="row-main" onClick={() => an.setFocus({ from: m.from, to: m.to })}>
                  <span class="row-title">
                    {SPOT_LABEL[m.type]} → {pcName(m.target)}
                  </span>
                  <span class="row-sub">
                    {bars(plan, m.from, m.to)} · {chords(plan, m.from, m.to)}
                  </span>
                </span>
                <button class="icon-btn" aria-label="Retirer" onClick={() => an.remove(m)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {an.saved.marks.length ? (
          <div class="row-actions">
            <button class="btn primary" onClick={an.check}>
              Vérifier ({an.saved.marks.length})
            </button>
          </div>
        ) : null}
      </section>
    );
  }
  const missedMain = r.missed.filter((s) => s.main);
  const missedMore = r.missed.filter((s) => !s.main);
  const row = (key: string, icon: string, cls: string, title: string, sub: string, text: string, span?: { from: number; to: number }) => (
    <button key={key} class={'an-res ' + cls} onClick={() => span && an.setFocus(span)}>
      <span class="an-icon">{icon}</span>
      <span class="row-main">
        <span class="row-title">{title}</span>
        <span class="row-sub">{sub}</span>
        <span class="an-text">{text}</span>
      </span>
    </button>
  );
  return (
    <section class="an-panel">
      <p class={'verdict ' + (r.found === r.total ? 'ok' : 'bad')}>
        Trouvé : {r.found} sur {r.total} enchaînement{r.total > 1 ? 's' : ''}.
      </p>
      <p class="muted small">Touche une ligne pour la voir dans la grille. ✓ juste · ≈ presque · ✗ faux · ○ manqué.</p>
      {r.results.length ? <h2 class="label">Tes repérages</h2> : null}
      {r.results.map((x, i) =>
        row(
          'r' + i,
          x.verdict === 'ok' ? '✓' : x.verdict === 'near' ? '≈' : '✗',
          x.verdict,
          `${SPOT_LABEL[x.mark.type]} → ${pcName(x.mark.target)}`,
          `${bars(plan, x.mark.from, x.mark.to)} · ${chords(plan, x.mark.from, x.mark.to)}`,
          x.text,
          x.mark
        )
      )}
      {missedMain.length ? <h2 class="label">Tu as manqué</h2> : null}
      {missedMain.map((s: Spot, i) => row('m' + i, '○', 'missed', `${SPOT_LABEL[s.type]} → ${noteName(s.target.tonic)}`, `${bars(plan, s.from, s.to)} · ${chords(plan, s.from, s.to)}`, s.explain, s))}
      {missedMore.length || r.extras.length ? <h2 class="label">À voir aussi</h2> : null}
      {missedMore.map((s, i) => row('x' + i, '+', 'more', `${SPOT_LABEL[s.type]} → ${noteName(s.target.tonic)}`, `${bars(plan, s.from, s.to)} · ${chords(plan, s.from, s.to)}`, s.explain, s))}
      {r.extras.map((t, i) => (
        <p key={'e' + i} class="small an-extra">
          {t}
        </p>
      ))}
      <div class="row-actions">
        <button class="btn" onClick={onShowDegrees}>
          Voir les degrés
        </button>
        <button class="btn primary" onClick={an.reset}>
          Recommencer
        </button>
      </div>
    </section>
  );
}

/** Après avoir choisi 1er et dernier accord : quel enchaînement, vers quelle tonalité. */
export function AnalyserForm({ an, plan }: { an: Analyser; plan: ImprovPlan }) {
  const f = an.form;
  const [type, setType] = useState<SpotType | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => {
    setType(null);
    setTarget(null);
  }, [f?.from, f?.to]);
  if (!f) return null;
  const listen = () => {
    audio();
    const t0 = now() + 0.05;
    let t = t0;
    for (let i = f.from; i <= f.to; i++) {
      if (i > f.from && chordSymbol(plan.flat[i].chord) === chordSymbol(plan.flat[i - 1].chord)) continue;
      playChord(displayVoicing(plan.flat[i].chord, plan.scales[i].scale), t, 1.1, 0.55);
      t += 1.1;
    }
  };
  return (
    <div class="chord-card an-form">
      <div class="cc-head">
        <span class="cc-sym an-sel">{chords(plan, f.from, f.to)}</span>
        <button class="btn sm" onClick={listen}>
          <PlayIcon /> Écouter
        </button>
      </div>
      <p class="muted small">{bars(plan, f.from, f.to)}</p>
      <Field label="C’est…">
        <Segmented cards cols={2} label="Enchaînement" value={type ?? ('' as SpotType)} onChange={setType} options={SPOT_ORDER.map((t) => ({ value: t, label: SPOT_LABEL[t], sub: SPOT_SUB[t] }))} />
      </Field>
      <Field label="Vers quelle tonalité ?">
        <div class="chips roots">
          {Array.from({ length: 12 }, (_, pc) => (
            <button key={pc} class="chip" aria-pressed={target === pc} onClick={() => setTarget(pc)}>
              {pcName(pc)}
            </button>
          ))}
        </div>
        <p class="muted small">La tonique visée : celle du I (ou de l’accord d’arrivée).</p>
      </Field>
      <button class="btn primary block" disabled={type === null || target === null} onClick={() => an.add(type!, target!)}>
        Ajouter
      </button>
    </div>
  );
}
