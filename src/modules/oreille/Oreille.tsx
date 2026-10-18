import { useEffect, useRef, useState } from 'preact/hooks';
import { Chord, QUALITIES, chordNotes, chordOnPc, chordPcs, chordSymbol, spellInChord } from '../../core/theory/chords';
import { lettersFor, mod, noteName, pcOf, plainName, spellCost, spellWith } from '../../core/theory/notes';
import { audio, chord as playChord, now, piano, silence } from '../../core/audio/engine';
import { voiceLead } from '../../core/audio/voicing';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { BackIcon, PlayIcon } from '../../ui/icons';
import { go } from '../../ui/router';
import { load, save } from '../../core/storage';
import { HINTS, LEVEL_LABELS, PROGS, PROG_LEVELS, QUALITY_LEVELS, progRoman } from './data';

type Mode = 'ear' | 'prog' | 'build';
interface Stats {
  mode: Mode;
  lv: Record<Mode, number>;
  items: Record<string, { c: number; t: number }>;
  recent: Record<string, number[]>;
}
const DEFAULT_STATS: Stats = { mode: 'ear', lv: { ear: 1, prog: 1, build: 1 }, items: {}, recent: {} };

interface PlayedChord {
  chord: Chord;
  roman?: string;
  notes: number[];
}
type Question =
  | { mode: 'ear'; q: string; c: PlayedChord }
  | { mode: 'build'; q: string; c: PlayedChord }
  | { mode: 'prog'; id: string; chords: PlayedChord[] };

const rnd = (n: number) => Math.floor(Math.random() * n);
const bassOf = (pc: number) => 40 + mod(pc - 4, 12);

function closeAbove(pcs: number[], start: number) {
  const out: number[] = [];
  let cur = start - 1;
  for (const pc of pcs) {
    let m = cur + 1;
    while (mod(m, 12) !== pc) m++;
    out.push(m);
    cur = m;
  }
  return out;
}
function earVoicing(c: Chord): number[] {
  const iv = QUALITIES[c.quality].iv;
  const pc = pcOf(c.root);
  const use = iv.length >= 5 ? iv.slice(1) : iv;
  const b = bassOf(pc);
  return [b, ...closeAbove(use.map((i) => mod(pc + i, 12)), b + 12)];
}

function pick(keys: string[], prefix: string, stats: Stats, last?: string) {
  const w = keys.map((k) => {
    const it = stats.items[prefix + k] ?? { c: 0, t: 0 };
    let x = 1 + 2 * (1 - (it.c + 1) / (it.t + 2));
    if (k === last) x *= 0.3;
    return x;
  });
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length; i++) {
    r -= w[i];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}

function makeQuestion(mode: Mode, level: number, stats: Stats, last?: string): Question {
  if (mode === 'prog') {
    const id = pick(PROG_LEVELS[level - 1], 'prog:', stats, last);
    const keyPc = rnd(12);
    let best: { cost: number; chords: Chord[] } | null = null;
    for (const kl of lettersFor(keyPc)) {
      const chords = PROGS[id].chords.map(([off, semis, q]) => ({ root: spellWith(kl + off, keyPc + semis), quality: q }));
      const cost = chords.reduce((s, c) => s + spellCost(chordNotes(c)), 0) + spellCost([spellWith(kl, keyPc)]) * 2;
      if (!best || cost < best.cost) best = { cost, chords };
    }
    let prev: number[] | null = null;
    const chords = best!.chords.map((c, i) => {
      const v = voiceLead(c, prev, 52, 76);
      prev = v;
      return { chord: c, roman: PROGS[id].chords[i][3], notes: [bassOf(pcOf(c.root)), ...v] };
    });
    return { mode, id, chords };
  }
  const q = pick(QUALITY_LEVELS[level - 1], mode + ':', stats, last);
  const c = chordOnPc(rnd(12), q);
  return { mode, q, c: { chord: c, notes: earVoicing(c) } };
}

function labelsFor(pc: PlayedChord) {
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  pc.notes.forEach((m) => {
    marks[m] = 'hit';
    labels[m] = spellInChord(pc.chord, m);
  });
  return { marks, labels };
}

const TEXT: Record<Mode, [string, string]> = {
  ear: ['Quel type d’accord ?', 'Fondamentale à la basse, fondamentale au hasard.'],
  prog: ['Quelle progression ?', 'Tonalité au hasard. Écoute la basse et la couleur de chaque accord.'],
  build: ['Joue cet accord', 'Touche les notes puis Valider. Ordre et octave libres.']
};

export function Oreille() {
  const [stats, setStats] = useState<Stats>(() => load('oreille', DEFAULT_STATS));
  const mode = stats.mode;
  const level = stats.lv[mode];
  const [question, setQuestion] = useState<Question>(() => makeQuestion(mode, level, stats));
  const [answer, setAnswer] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [lit, setLit] = useState(-1);
  const [shown, setShown] = useState(0);
  const [session, setSession] = useState({ c: 0, t: 0, streak: 0 });
  const [armed, setArmed] = useState(false);
  const timers = useRef<number[]>([]);
  const last = useRef<string | undefined>(undefined);

  useEffect(() => save('oreille', stats), [stats]);
  useEffect(() => () => stop(), []);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    silence();
    setLit(-1);
  };

  const fresh = (m: Mode, l: number, autoplay: boolean) => {
    stop();
    const q = makeQuestion(m, l, stats, last.current);
    last.current = q.mode === 'prog' ? q.id : q.q;
    setQuestion(q);
    setAnswer(null);
    setOk(null);
    setSel([]);
    setShown(0);
    if (autoplay) play(q, false);
  };

  const play = (q: Question = question, arp = false) => {
    audio();
    stop();
    const t0 = now() + 0.06;
    if (q.mode === 'ear') {
      if (arp) q.c.notes.forEach((m, i) => piano(m, t0 + i * 0.16, 2.2, i === 0 ? 0.6 : 0.5));
      else playChord(q.c.notes, t0, 2.2, 0.6);
    } else if (q.mode === 'prog') {
      const step = 1.6;
      q.chords.forEach((c, i) => {
        playChord(c.notes, t0 + i * step, step - 0.1, 0.6);
        timers.current.push(window.setTimeout(() => setLit(i), i * step * 1000 + 60));
      });
      timers.current.push(window.setTimeout(() => setLit(-1), q.chords.length * step * 1000));
    }
  };

  const record = (item: string, good: boolean) => {
    setStats((s) => {
      const it = s.items[item] ?? { c: 0, t: 0 };
      const rk = s.mode + s.lv[s.mode];
      const r = [...(s.recent[rk] ?? []), good ? 1 : 0].slice(-10);
      return { ...s, items: { ...s.items, [item]: { c: it.c + (good ? 1 : 0), t: it.t + 1 } }, recent: { ...s.recent, [rk]: r } };
    });
    setSession((x) => ({ c: x.c + (good ? 1 : 0), t: x.t + 1, streak: good ? x.streak + 1 : 0 }));
  };

  const choose = (a: string) => {
    if (answer !== null) return;
    setAnswer(a);
    if (question.mode === 'ear') {
      const good = a === question.q;
      setOk(good);
      record('ear:' + question.q, good);
      play(question);
    } else if (question.mode === 'prog') {
      const good = a === question.id;
      setOk(good);
      record('prog:' + question.id, good);
      play(question);
    }
  };

  const validate = () => {
    if (question.mode !== 'build') return;
    const req = new Set(chordPcs(question.c.chord));
    const optional = new Set((QUALITIES[question.q].optional ?? []).map((i) => mod(pcOf(question.c.chord.root) + i, 12)));
    const got = new Set(sel.map((m) => mod(m, 12)));
    const good = [...req].every((p) => got.has(p)) && [...got].every((p) => req.has(p) || optional.has(p));
    setAnswer('build');
    setOk(good);
    record('build:' + question.q, good);
    audio();
    stop();
    playChord(targetVoicing(), now() + 0.05, 2.2, 0.6);
  };

  const targetVoicing = () => {
    if (question.mode !== 'build') return [];
    const r = 60 + pcOf(question.c.chord.root);
    return QUALITIES[question.q].iv.map((i) => {
      let x = r + i;
      while (x > 84) x -= 12;
      return x;
    });
  };

  const setMode = (m: Mode) => {
    if (m === mode) return;
    setStats((s) => ({ ...s, mode: m }));
    fresh(m, stats.lv[m], false);
  };
  const setLevel = (l: number) => {
    setStats((s) => ({ ...s, lv: { ...s.lv, [mode]: l } }));
    fresh(mode, l, false);
  };

  const answered = answer !== null;
  const recent = stats.recent[mode + level] ?? [];
  const recentScore = recent.reduce((a, b) => a + b, 0);
  const pool = mode === 'prog' ? PROG_LEVELS[level - 1] : QUALITY_LEVELS[level - 1];
  const rows = pool
    .map((k) => {
      const it = stats.items[mode + ':' + k] ?? { c: 0, t: 0 };
      return { k, label: mode === 'prog' ? PROGS[k].name : QUALITIES[k].sym, it, acc: it.t ? it.c / it.t : -1 };
    })
    .sort((a, b) => a.acc - b.acc);

  // Clavier
  let kb = null;
  if (question.mode === 'build') {
    const marks: Record<number, Mark> = {};
    const labels: Record<number, string> = {};
    if (!answered) {
      sel.forEach((m) => {
        marks[m] = 'sel';
        labels[m] = plainName(m);
      });
    } else {
      const names = new Map<number, string>();
      chordNotes(question.c.chord).forEach((n) => names.set(pcOf(n), noteName(n)));
      const req = chordPcs(question.c.chord);
      const opt = (QUALITIES[question.q].optional ?? []).map((i) => mod(pcOf(question.c.chord.root) + i, 12));
      const tv = targetVoicing();
      sel.forEach((m) => {
        const p = mod(m, 12);
        marks[m] = req.includes(p) || opt.includes(p) ? 'ok' : 'bad';
        labels[m] = names.get(p) ?? plainName(m);
      });
      req.forEach((p, i) => {
        if (!sel.some((m) => mod(m, 12) === p)) {
          marks[tv[i]] = 'miss';
          labels[tv[i]] = names.get(p) ?? '';
        }
      });
    }
    kb = (
      <>
        <Keyboard
          lo={60}
          hi={84}
          marks={marks}
          labels={labels}
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
        {answered ? <p class="hint small">Vert : juste · rouge : en trop · pointillés : manquant</p> : null}
      </>
    );
  } else if (!answered) {
    kb = <div class="placeholder">Le voicing s’affiche sur le clavier après ta réponse.</div>;
  } else {
    const pc = question.mode === 'ear' ? question.c : question.chords[Math.max(0, lit >= 0 ? lit : shown)];
    const { marks, labels } = labelsFor(pc);
    kb = <Keyboard lo={36} hi={84} marks={marks} labels={labels} center={pc.notes} />;
  }

  return (
    <div class="screen">
      <div class="topbar">
        <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
        <h1>Entendre</h1>
        <div class="score">
          <div><span>{session.c}/{session.t}</span><small>session</small></div>
          <div><span>{session.streak}</span><small>série</small></div>
        </div>
      </div>

      <div class="tabs" role="tablist">
        {(['ear', 'prog', 'build'] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
            {m === 'ear' ? 'Accords' : m === 'prog' ? 'Progressions' : 'Construire'}
          </button>
        ))}
      </div>
      <div class="levels">
        {LEVEL_LABELS[mode].map((t, i) => (
          <button key={i} class="lv" aria-pressed={level === i + 1} onClick={() => setLevel(i + 1)}>
            <b>N{i + 1}</b>
            <span>{t}</span>
          </button>
        ))}
      </div>
      {recent.length === 10 && recentScore >= 8 && level < 4 ? (
        <div class="nudge">
          <span>{recentScore}/10 sur tes dernières réponses. Prêt pour le N{level + 1}.</span>
          <button onClick={() => setLevel(level + 1)}>Passer au N{level + 1}</button>
        </div>
      ) : null}

      <section class="stage" aria-live="polite">
        <div>
          <h2>{TEXT[mode][0]}</h2>
          <p class="sub">{TEXT[mode][1]}</p>
        </div>

        {question.mode === 'build' ? (
          <div class="playrow">
            <div class="target-sym">{chordSymbol(question.c.chord)}</div>
            <button class="btn" onClick={() => { audio(); stop(); playChord([...sel].sort((a, b) => a - b), now() + 0.05, 2, 0.55); }}>Écouter ma sélection</button>
            <button class="btn quiet" onClick={() => setSel([])} disabled={answered}>Effacer</button>
          </div>
        ) : (
          <div class="playrow">
            <button class={'big'} aria-label="Écouter" onClick={() => play(question, false)}><PlayIcon /></button>
            {question.mode === 'ear' ? <button class="btn" onClick={() => play(question, true)}>Arpège</button> : null}
            <span class="sub" style="margin:0">{question.mode === 'ear' ? 'Rejoue autant que nécessaire.' : `${question.chords.length} accords`}</span>
          </div>
        )}

        {question.mode === 'prog' ? (
          <div class="dots">{question.chords.map((_, i) => <i key={i} class={lit === i ? 'on' : ''} />)}</div>
        ) : null}

        {question.mode === 'build' ? (
          answered ? null : (
            <button class="validate" disabled={!sel.length} onClick={validate}>
              Valider ({sel.length} note{sel.length > 1 ? 's' : ''})
            </button>
          )
        ) : (
          <div class={'opts' + (mode === 'prog' ? ' wide' : '')}>
            {pool.map((k) => {
              const right = question.mode === 'prog' ? k === question.id : k === question.q;
              const cls = answered ? (right ? ' is-ok' : k === answer ? ' is-bad' : '') : '';
              return (
                <button key={k} class={'opt' + cls} disabled={answered} onClick={() => choose(k)}>
                  <b>{mode === 'prog' ? progRoman(k) : QUALITIES[k].sym}</b>
                  <span>{mode === 'prog' ? PROGS[k].name : QUALITIES[k].name}</span>
                </button>
              );
            })}
          </div>
        )}

        {answered ? (
          <div class="fb">
            {question.mode === 'ear' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>
                  {ok ? 'Juste.' : 'Raté.'} C’était {chordSymbol(question.c.chord)}
                  {ok ? '' : `, pas ${QUALITIES[answer!].sym}`}.
                </p>
                <p class="mono">{chordNotes(question.c.chord).map(noteName).join(' · ')}</p>
                <p class="hint">{HINTS[question.q]}</p>
              </>
            ) : question.mode === 'prog' ? (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>
                  {ok ? 'Juste.' : 'Raté.'} {PROGS[question.id].name}
                  {ok ? '' : ` (tu as choisi : ${PROGS[answer!].name})`}.
                </p>
                <div class="pchips">
                  {question.chords.map((c, i) => (
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
                <p class="hint">{PROGS[question.id].hint} Touche un accord pour l’entendre seul.</p>
              </>
            ) : (
              <>
                <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? 'Juste.' : 'Pas tout à fait.'} {chordSymbol(question.c.chord)}</p>
                <p class="mono">
                  {chordNotes(question.c.chord).map(noteName).join(' · ')}
                  {QUALITIES[question.q].optional ? ' (quinte facultative)' : ''}
                </p>
                <p class="hint">{HINTS[question.q]}</p>
              </>
            )}
          </div>
        ) : null}

        {kb}

        {answered ? <button class="next" onClick={() => fresh(mode, level, question.mode !== 'build')}>Suivant</button> : null}
      </section>

      <section class="stats">
        <h2>Ta progression</h2>
        <div class="recent">
          <span>N{level}, 10 dernières :</span>
          {Array.from({ length: 10 }, (_, i) => <i key={i} class={i < recent.length ? (recent[i] ? 'y' : 'n') : ''} />)}
          <span>{recentScore}/{recent.length}</span>
        </div>
        <div class="bars">
          {rows.map((r) => {
            const p = Math.round(r.acc * 100);
            const col = r.acc < 0 ? 'var(--line)' : r.acc >= 0.8 ? 'var(--ok)' : r.acc >= 0.5 ? 'var(--accent)' : 'var(--bad)';
            return (
              <div class="statbar" key={r.k}>
                <span class="lb">{r.label}</span>
                <span class="tr"><span class="fl" style={`width:${r.acc < 0 ? 0 : Math.max(4, p)}%;background:${col}`} /></span>
                <span class="v">{r.acc < 0 ? '—' : `${p} % · ${r.it.c}/${r.it.t}`}</span>
              </div>
            );
          })}
        </div>
        <button
          class={'linkbtn' + (armed ? ' armed' : '')}
          onClick={() => {
            if (armed) {
              setStats((s) => ({ ...s, items: {}, recent: {} }));
              setArmed(false);
            } else {
              setArmed(true);
              setTimeout(() => setArmed(false), 3000);
            }
          }}
        >
          {armed ? 'Toucher encore pour confirmer' : 'Remettre les stats à zéro'}
        </button>
      </section>
    </div>
  );
}
