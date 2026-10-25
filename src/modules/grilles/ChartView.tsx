// Une grille : lecture et analyse, gammes, guide tones, play-along, pupitre, écoute au micro.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chart, hasLyrics, keyLabel, keyName, transposeChart } from '../../core/chart/model';
import { barRows, chordsByBar } from '../../core/chart/layout';
import { ImprovPlan, improvPlan } from '../../core/analysis/improv';
import { chordNotes, chordSymbol } from '../../core/theory/chords';
import { noteName } from '../../core/theory/notes';
import { SCALES } from '../../core/theory/scales';
import { audio, now, playChord } from '../../core/audio/engine';
import { displayVoicing } from '../../core/audio/voicing';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { TopBar } from '../../ui/Screen';
import { Segmented } from '../../ui/Segmented';
import { Drawer } from '../../ui/Drawer';
import { MicPill } from '../../ui/MicPill';
import { TransposeStepper } from '../../ui/TransposeStepper';
import { PlayerBar } from '../../ui/PlayerBar';
import { usePlayer } from '../../ui/usePlayer';
import { Stand } from '../../ui/Stand';
import { StandIcon } from '../../ui/icons';
import { notesMarks, scaleMarks } from '../../ui/keyboardMarks';
import { ListenMode, useListening } from './useListening';
import { ListenButtons, useListen, withActive } from '../../ui/Listen';
import { Comprendre, PhraseQuiz } from './Story';
import { MemoirePanel, useMemoire } from './Memoire';
import { MelodyPanel, RecStatus, useMelodyRecorder, useMelodyStore } from './MelodyRec';
import { LyricsView } from './Lyrics';

export type Mode = ListenMode | 'comprendre' | 'analyser' | 'memoire' | 'paroles';
type Listen = ReturnType<typeof useListening>;
const LIVE_LO = 55;
const LIVE_HI = 79;
const MODES: Mode[] = ['comprendre', 'analyser', 'analyse', 'gammes', 'guide', 'memoire', 'paroles'];

/** onBack : retour (au parcours) au lieu de la liste des morceaux ; memLevel : niveau de mémoire imposé. */
export function ChartView({ chart: original, initialMode, onBack, memLevel }: { chart: Chart; initialMode?: Mode; onBack?: () => void; memLevel?: number }) {
  const lyrics = useMemo(() => hasLyrics(original), [original]);
  const [view, setView] = useState(() => {
    const v = load('grille-vue', { mode: 'comprendre', showRomans: true });
    // Un morceau avec ses paroles s'ouvre sur les paroles : c'est pour le jouer.
    return initialMode ? { ...v, mode: initialMode } : lyrics ? { ...v, mode: 'paroles' } : v;
  });
  const mode: Mode = MODES.includes(view.mode as Mode) && (view.mode !== 'paroles' || lyrics) ? (view.mode as Mode) : 'comprendre';
  const [shift, setShift] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [stand, setStand] = useState(false);
  useEffect(() => save('grille-vue', view), [view]);

  const chart = useMemo(() => transposeChart(original, shift), [original, shift]);
  const plan = useMemo(() => improvPlan(chart), [chart]);
  const rows = useMemo(() => barRows(chart), [chart]);
  const byBar = useMemo(() => chordsByBar(plan.flat), [plan]);
  const melody = useMelodyStore(original.id, shift);
  const player = usePlayer(chart, original.id, original.tempo, melody.shifted);
  const barOf = (beat: number) => [...plan.flat].reverse().find((f) => f.start <= beat + 1e-6)?.bar ?? 0;
  const rec = useMelodyRecorder(player, melody, shift, barOf);
  const recording = rec.phase === 'rec' || rec.phase === 'mic';
  const listenMode: ListenMode = mode === 'gammes' || mode === 'guide' ? mode : 'analyse';
  const grid = mode === 'analyse' || mode === 'gammes' || mode === 'guide' || mode === 'memoire';
  // Pendant l'enregistrement de la mélodie, le micro n'évalue rien d'autre.
  const listen = useListening(listenMode, plan, recording ? null : player.pos, chart.beatsPerBar);
  // Premier accord de chaque ligne : reste visible au niveau « 3/4 » de la mémoire.
  const firsts = useMemo(() => rows.map((r) => (byBar.get(r.bars[0]) ?? [])[0]).filter((x): x is number => x !== undefined), [rows, byBar]);
  const mem = useMemoire(original.id, plan, firsts, mode === 'memoire', memLevel);
  const pos = player.pos;
  const n = plan.flat.length;
  const sel = selected !== null && selected < n ? selected : null;
  const cur = pos ? pos.chord : (sel ?? 0);
  const showRomans = mode === 'analyse';
  const liveRef = useRef<HTMLDivElement>(null);

  // Fin d'une lecture écoutée au micro : on compte pour la collection de standards.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (player.playing) wasPlaying.current = !rec.active.current;
    else if (wasPlaying.current && listen.listening) {
      wasPlaying.current = false;
      const sm = listen.summary;
      if (listenMode === 'analyse' && sm.compChords) report({ type: 'listen', chart: original.id, mode: 'analyse', ratio: sm.compOk / sm.compChords, chords: sm.compChords });
      else if (listenMode !== 'analyse' && sm.chords) report({ type: 'listen', chart: original.id, mode: listenMode, ratio: sm.targets / sm.chords, chords: sm.chords });
    }
  }, [player.playing]);

  // Au micro, le piano de l'appli gênerait l'écoute : on le coupe.
  const onMic = (on: boolean) => {
    if (on && player.prefs.comp) player.set('comp', false);
  };

  // Garde la mesure jouée visible.
  useEffect(() => {
    if (!pos) return;
    const el = document.querySelector(`[data-ci="${pos.chord}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = (liveRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
    const bottom = window.innerHeight - 120;
    if (r.top < top || r.bottom > bottom) window.scrollBy({ top: r.top - top - 24, behavior: 'smooth' });
  }, [pos?.bar]);

  // Mémoire : la case demandée reste visible sous le panneau.
  useEffect(() => {
    if (mode !== 'memoire' || mem.current === null || pos) return;
    const el = document.querySelector(`[data-ci="${mem.current}"]`);
    const panel = document.querySelector('.mem-panel');
    if (!el || !panel) return;
    const r = el.getBoundingClientRect();
    const top = panel.getBoundingClientRect().bottom + 8;
    if (r.top < top || r.bottom > window.innerHeight - 120) window.scrollBy({ top: r.top - top - 16, behavior: 'smooth' });
  }, [mem.current, mode]);

  const keyTags = useMemo(() => {
    const m = new Map<number, string>();
    plan.analysis.regions.forEach((r) => {
      const bar = plan.flat[r.from]?.bar;
      if (bar !== undefined && !m.has(bar)) m.set(bar, keyName(r.key));
    });
    return m;
  }, [plan]);

  const bracketPart = (i: number) => {
    const b = plan.analysis.brackets.find((x) => x.from <= i && i <= x.to);
    if (!b) return '';
    return `${i === b.from ? ' l' : ''}${i === b.to ? ' r' : ''}${b.kind === 'iiSubV' ? ' sub' : ''} on`;
  };

  const tapChord = (ci: number) => {
    setSelected(ci);
    if (mode === 'analyse') setDrawer(true);
    if (mode === 'memoire') {
      mem.pick(ci);
      // Une case cachée ne se fait pas entendre : ce serait la réponse.
      if (mem.masked.has(ci) && mem.decor(ci).sym) return;
    }
    if (!player.playing) {
      audio();
      playChord(displayVoicing(plan.flat[ci].chord, plan.scales[ci].scale), now() + 0.02, 1.3, 0.55);
    }
  };

  return (
    <>
      <div class="screen with-player">
        <TopBar
          title={chart.title}
          back={onBack ? undefined : '/morceaux'}
          onBack={onBack}
          actions={
            <>
              <button class="icon-btn" aria-label="Mode pupitre" onClick={() => setStand(true)}>
                <StandIcon />
              </button>
              <MicPill onChange={onMic} />
            </>
          }
        />
        <Segmented
          label="Affichage"
          value={mode === 'gammes' || mode === 'guide' ? 'impro' : mode}
          onChange={(m: string) => setView({ ...view, mode: m === 'impro' ? 'gammes' : m })}
          options={[
            ...(lyrics ? [{ value: 'paroles', label: 'Paroles' }] : []),
            { value: 'comprendre', label: 'Comprendre' },
            { value: 'analyser', label: 'Quiz' },
            { value: 'analyse', label: 'Accords' },
            { value: 'impro', label: 'Impro' },
            { value: 'memoire', label: 'Mémoire' }
          ]}
        />
        {mode === 'gammes' || mode === 'guide' ? (
          <Segmented
            label="Impro"
            value={mode}
            onChange={(m: string) => setView({ ...view, mode: m })}
            options={[
              { value: 'gammes', label: 'Gammes', sub: 'La gamme de chaque accord' },
              { value: 'guide', label: 'Guide tones', sub: 'La 3ce et la 7e, d’un accord à l’autre' }
            ]}
          />
        ) : null}
        <div class="subbar">
          <TransposeStepper chartKey={chart.key} shift={shift} onShift={setShift} />
        </div>
        {mode === 'paroles' ? <LyricsView chart={chart} plan={plan} pos={pos} selBar={sel !== null ? plan.flat[sel].bar : null} onTap={tapChord} /> : null}
        {mode === 'comprendre' ? <Comprendre chart={chart} plan={plan} player={player} /> : null}
        {mode === 'analyser' ? <PhraseQuiz key={chart.id + shift} chart={chart} plan={plan} player={player} onExplain={() => setView({ ...view, mode: 'comprendre' })} /> : null}
        {mode === 'analyse' ? <p class="muted small">Tous les accords, avec leur degré (en bleu : hors de la tonalité). Touche un accord pour sa fiche. Au micro : accompagne, l’appli vérifie la 3ce et la 7e.</p> : null}
        {mode === 'memoire' ? <MemoirePanel m={mem} plan={plan} /> : null}

        {(mode === 'gammes' || mode === 'guide') && n ? <LivePanel refEl={liveRef} mode={mode} plan={plan} cur={cur} listen={listen} /> : null}

        {listen.listening && grid && !recording ? <ListenSummary mode={mode} listen={listen} playing={player.playing} /> : null}

        {grid ? (
        <div class="chart">
          {rows.map((row, ri) => (
            <div key={ri}>
              {row.label ? <div class="sec-label">{row.label}</div> : null}
              <div class="sysrow">
                {row.bars.map((bi) => {
                  const idxs = byBar.get(bi) ?? [];
                  return (
                    <div key={bi} class={'bar' + (pos?.bar === bi ? ' now' : '')}>
                      <span class="barnum">{bi + 1}</span>
                      {showRomans && keyTags.has(bi) ? <span class="keytag">{keyTags.get(bi)}</span> : null}
                      <div class={'chords' + (idxs.length > 1 ? ' two' : '')}>
                        {idxs.map((ci) => {
                          const a = plan.analysis.chords[ci];
                          const st = listen.statusOf(pos?.chorus ?? 0, ci);
                          const md = mode === 'memoire' ? mem.decor(ci) : null;
                          let sub = '';
                          let subCls = 'rn';
                          if (mode === 'analyse') {
                            const arrow = a.resolution && a.resolvesTo === (ci + 1) % n ? (a.resolution === 'sub' ? ' ⇣' : ' ↗') : '';
                            sub = a.roman + arrow;
                            if (!a.diatonic) subCls += ' out';
                          } else if (mode === 'gammes') sub = SCALES[plan.scales[ci].scale].short;
                          else if (mode === 'guide') sub = `${plan.guideA[ci].name} · ${plan.guideB[ci].name}`;
                          const lCls = st?.done ? (st.ok ? ' l-ok' : ' l-miss') : '';
                          return (
                            <button key={ci} data-ci={ci} class={'ch' + (cur === ci && (pos || (sel !== null && mode !== 'memoire')) ? ' now' : '') + lCls + (md?.cls ?? '')} onClick={() => tapChord(ci)}>
                              <span class="sym">{md?.sym ?? chordSymbol(plan.flat[ci].chord)}</span>
                              <span class={subCls}>{sub || ' '}</span>
                              {mode === 'analyse' ? <i class={'bk' + bracketPart(ci)} /> : null}
                              {st && st.hits.length ? (
                                <span class="hits">
                                  {st.hits.slice(-8).map((h, i) => (
                                    <i key={i} class={mode === 'guide' ? (h.guide ? 'chord' : 'out') : h.cls} />
                                  ))}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        ) : null}

        {mode === 'analyse' ? (
          <p class="legend">
            <span><i class="lg-bk" />ii–V</span>
            <span><i class="lg-bk sub" />ii–SubV</span>
            <span>↗ résout une quarte plus haut</span>
            <span>⇣ un demi-ton plus bas</span>
            <span class="lg-out">bleu : hors tonalité</span>
          </p>
        ) : null}

      </div>

      <PlayerBar
        p={player}
        fromBar={sel !== null ? plan.flat[sel].bar : 0}
        status={rec.phase !== 'idle' ? <RecStatus r={rec} /> : undefined}
        extra={(close) => <MelodyPanel r={rec} store={melody} fromBar={sel !== null ? plan.flat[sel].bar : 0} onRecord={close} />}
      />

      <Drawer open={drawer && sel !== null && mode === 'analyse'} onClose={() => setDrawer(false)} label="Accord">
        {sel !== null ? (
          <ChordCard
            plan={plan}
            i={sel}
            onPlayFrom={(bar) => {
              setDrawer(false);
              player.start(bar);
            }}
          />
        ) : null}
      </Drawer>

      {stand ? <Stand chart={chart} plan={plan} player={player} initial={listenMode} startIndex={cur} onClose={() => setStand(false)} /> : null}
    </>
  );
}

// ---------------------------------------------------------------- Panneau Gammes / Guide tones

function LivePanel({ refEl, mode, plan, cur, listen }: { refEl: { current: HTMLDivElement | null }; mode: Mode; plan: ImprovPlan; cur: number; listen: Listen }) {
  const c = plan.flat[cur].chord;
  const sc = plan.scales[cur];
  const a = plan.analysis.chords[cur];
  const nx = (cur + 1) % plan.flat.length;
  let km: { marks: Record<number, Mark>; labels: Record<number, string> };
  if (mode === 'gammes') km = scaleMarks(c, sc.scale, LIVE_LO, LIVE_HI);
  else {
    const A = plan.guideA[cur];
    const B = plan.guideB[cur];
    km = { marks: { [A.midi]: 'hit', [B.midi]: 'ok' }, labels: { [A.midi]: A.name, [B.midi]: B.name } };
  }
  const nextText =
    mode === 'gammes'
      ? `${chordSymbol(plan.flat[nx].chord)} · ${SCALES[plan.scales[nx].scale].name}`
      : `${chordSymbol(plan.flat[nx].chord)} · ${plan.guideA[nx].name} / ${plan.guideB[nx].name}`;
  const last = listen.last;
  return (
    <div class="live" ref={refEl}>
      <div class="live-head">
        <span class="live-sym">{chordSymbol(c)}</span>
        <span class="live-rn">{a.roman}</span>
        <span class="muted small">{keyLabel(a.key)}</span>
      </div>
      {mode === 'gammes' ? (
        <p class="live-info">
          <b>{SCALES[sc.scale].name}</b>
          {sc.alt ? <span class="muted"> · ou {SCALES[sc.alt].name}</span> : null}
        </p>
      ) : (
        <p class="live-info">
          <i class="dot a" />
          <b>{plan.guideA[cur].name}</b> <span class="muted">({plan.guideA[cur].role})</span>
          <i class="dot b" />
          <b>{plan.guideB[cur].name}</b> <span class="muted">({plan.guideB[cur].role})</span>
        </p>
      )}
      <Keyboard lo={LIVE_LO} hi={LIVE_HI} marks={km.marks} labels={km.labels} fit />
      {listen.listening && last ? (
        <p class={'heard ' + (mode === 'guide' ? (last.guide ? 'chord' : 'out') : last.cls)}>
          <b>{last.name}</b> ({last.deg}) ·{' '}
          {mode === 'guide'
            ? last.guide
              ? 'guide tone'
              : 'pas une guide tone'
            : { chord: 'note de l’accord', scale: 'note de la gamme', approach: 'approche chromatique', out: 'hors gamme' }[last.cls]}
        </p>
      ) : null}
      <p class="live-next">Ensuite : {nextText}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Bilan d'écoute

function ListenSummary({ mode, listen, playing }: { mode: Mode; listen: Listen; playing: boolean }) {
  const s = listen.summary;
  if (!playing && !s.chords && !s.notes) {
    return (
      <p class="listen-hint">
        {mode === 'analyse'
          ? 'Lance la lecture et accompagne : l’appli vérifie la 3ce et la 7e de chaque accord (la 5te pour un accord de 3 sons). Le piano de l’appli est coupé.'
          : 'Lance la lecture et joue la main droite seule. Sans écouteurs, coupe aussi la basse (Instruments).'}
      </p>
    );
  }
  return (
    <div class="summary">
      {mode === 'analyse' ? (
        <span>
          <b>{s.compOk}/{s.compChords}</b> accords justes
        </span>
      ) : (
        <>
          <span>
            <b>{s.targets}/{s.chords}</b> {mode === 'guide' ? 'guide tones au 1er temps' : 'notes de l’accord au 1er temps'}
          </span>
          {mode === 'gammes' && s.notes ? (
            <span>
              <b>{s.notes}</b> notes · <em class="s-chord">{s.chord} %</em> accord · <em class="s-scale">{s.scale} %</em> gamme · {s.approach} % approches ·{' '}
              <em class="s-out">{s.out} %</em> hors
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Fiche d'accord et quiz

function ChordCard({ plan, i, onPlayFrom }: { plan: ImprovPlan; i: number; onPlayFrom: (bar: number) => void }) {
  const f = plan.flat[i];
  const a = plan.analysis.chords[i];
  const voicing = displayVoicing(f.chord, plan.scales[i].scale);
  const km = notesMarks(f.chord, voicing);
  const l = useListen();
  return (
    <div class="chord-card">
      <div class="cc-head">
        <span class="cc-sym">{chordSymbol(f.chord)}</span>
        <span class="cc-rn">
          {a.roman} · {keyName(a.key)}
        </span>
      </div>
      <p>{a.explain}</p>
      <p class="muted small">
        Notes <span class="mono">{chordNotes(f.chord).map(noteName).join(' ')}</span> · gamme {SCALES[plan.scales[i].scale].name}
      </p>
      <Keyboard lo={36} hi={84} marks={withActive(km.marks, l.active)} labels={km.labels} center={voicing} />
      <div class="actions">
        <ListenButtons notes={voicing} l={l} />
        <button class="btn" onClick={() => onPlayFrom(f.bar)}>
          Jouer depuis la mesure {f.bar + 1}
        </button>
      </div>
    </div>
  );
}
