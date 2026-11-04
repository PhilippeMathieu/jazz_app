// Bandes-son : les play-alongs de l'élève (ses fichiers, importés une fois, gardés sur l'appareil), calés mesure par
// mesure. Pendant la lecture : l'accord et la tonalité en cours, la suivante, les notes de la gamme au clavier ;
// rejouer une tonalité en boucle, ralentir sans changer la hauteur.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Chord, chordPcs, chordSymbol } from '../../core/theory/chords';
import { mod, noteName, pcOf } from '../../core/theory/notes';
import { SCALES, scaleNotes } from '../../core/theory/scales';
import { deleteTrack, getTrack, keepStorage, listTracks, saveTrack } from '../../core/audio/trackStore';
import { PlayTrack, VOLUMES, barLength, chordAt, isCalibrated, matchFile, scaleFor, segChords, trackById, trackId } from '../../library/playalong';
import { load, save } from '../../core/storage';
import { Keyboard, Mark } from '../../ui/Keyboard';
import { TopBar } from '../../ui/Screen';
import { ChevronIcon, PauseIcon, PlayIcon } from '../../ui/icons';
import { Segmented } from '../../ui/Segmented';
import { ConfirmButton } from '../../ui/ConfirmButton';
import { useWakeLock } from '../../ui/wakeLock';
import { toast } from '../../ui/Rewards';

const LO = 48;
const HI = 84;

/** Ce qu'on entend sur une piste, en une ligne. */
function describe(t: PlayTrack): string {
  if (!isCalibrated(t)) return 'Pas encore calée : lecture seule, sans grille';
  if (t.form === 'blues') return `Blues de 12 mesures · ♩ = ${t.tempo}`;
  const keys = new Set(t.segs!.map((s) => s[1])).size;
  const per = t.perKey === 1 ? '1 mesure' : `${t.perKey} mesures`;
  return `${keys > 12 ? 'Deux couleurs, ' : ''}12 tonalités, ${per} chacune · ♩ = ${t.tempo}`;
}

// ---------------------------------------------------------------- Liste et import

export function BandesList() {
  const [have, setHave] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);
  const refresh = () =>
    listTracks()
      .then(setHave)
      .catch(() => setHave([]));
  useEffect(() => void refresh(), []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    keepStorage();
    const ok: string[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(files)) {
      const t = matchFile(f.name);
      if (!t) {
        skipped.push(f.name);
        continue;
      }
      try {
        await saveTrack(trackId(t), f);
        ok.push(trackId(t));
      } catch {
        skipped.push(f.name);
      }
    }
    setBusy(false);
    setReport(skipped.length ? [`Non reconnus (le nom doit commencer par le numéro de la piste) : ${skipped.join(', ')}`] : []);
    if (ok.length) toast({ kind: 'ok', title: `${ok.length} piste${ok.length > 1 ? 's' : ''} importée${ok.length > 1 ? 's' : ''}`, sub: 'Gardées sur cet appareil' });
    void refresh();
  };

  return (
    <div class="screen bandes">
      <TopBar title="Bandes-son" />
      <p class="intro">
        Tes play-alongs Jamey Aebersold, avec un vrai trio. Pendant la lecture : la tonalité en cours, la suivante, et les notes de la gamme au clavier. Les fichiers restent sur ton téléphone : importe-les une fois.
      </p>
      <label class={'btn primary block' + (busy ? ' busy' : '')}>
        {busy ? 'Import en cours…' : 'Importer mes fichiers (mp3)'}
        <input type="file" accept="audio/*,.mp3,.m4a" multiple hidden onChange={(e) => onFiles((e.target as HTMLInputElement).files)} />
      </label>
      {report.map((r) => (
        <p key={r} class="muted small">
          {r}
        </p>
      ))}
      {VOLUMES.map((v) => (
        <section key={v.vol}>
          <h2 class="label">{v.title}</h2>
          <p class="muted small bandes-vol">{v.sub}</p>
          <div class="list">
            {v.tracks.map((t) => {
              const id = trackId(t);
              const here = have?.includes(id);
              return (
                <a key={id} class={'row' + (here ? '' : ' absent')} href={here ? `#/bandes/${id}` : undefined} aria-disabled={!here}>
                  <span class="row-main">
                    <span class="row-title">
                      {t.track}. {t.title}
                    </span>
                    <span class="row-sub">
                      {describe(t)}
                      {here ? '' : ' · à importer'}
                    </span>
                  </span>
                  {here ? <ChevronIcon /> : null}
                </a>
              );
            })}
          </div>
        </section>
      ))}
      {have?.length ? (
        <ConfirmButton
          label={`Effacer les ${have.length} pistes importées`}
          confirm="Toucher encore pour effacer"
          onConfirm={async () => {
            for (const id of have) await deleteTrack(id);
            void refresh();
          }}
        />
      ) : null}
      <p class="credits">Aucun son n’est fourni avec l’appli : seulement le calage (mesures et accords) des pistes que tu possèdes.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Lecteur

/** Clavier : les notes de la gamme, celles de l'accord en bleu. Blues : la gamme blues de la tonalité. */
function marksFor(t: PlayTrack, c: Chord, tonic: Chord | null): { marks: Record<number, Mark>; labels: Record<number, string> } {
  const sc = scaleFor(t, c);
  const root = sc === 'blues' && tonic ? tonic.root : c.root;
  const notes = scaleNotes(root, pcOf(root), sc);
  const names = new Map(notes.map((n) => [pcOf(n), noteName(n)]));
  const tones = new Set(chordPcs(c));
  const marks: Record<number, Mark> = {};
  const labels: Record<number, string> = {};
  for (let m = LO; m <= HI; m++) {
    const p = mod(m, 12);
    if (!names.has(p)) continue;
    marks[m] = tones.has(p) ? 'hit' : 'soft';
    labels[m] = names.get(p)!;
  }
  return { marks, labels };
}

interface Saved {
  speed: number;
}

export function BandesPlayer({ id }: { id: string }) {
  const t = trackById(id);
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let u: string | null = null;
    getTrack(id)
      .then((b) => {
        if (!b) return setMissing(true);
        u = URL.createObjectURL(b);
        setUrl(u);
      })
      .catch(() => setMissing(true));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  if (!t) return null;
  if (missing)
    return (
      <div class="screen">
        <TopBar title={t.title} back="/bandes" />
        <p class="muted">Ce fichier n’est pas sur cet appareil : importe-le depuis la liste des bandes-son.</p>
      </div>
    );
  return url ? <Player t={t} url={url} /> : <div class="screen" />;
}

/** Unité de travail : une tonalité (cycle) ou une phrase de 4 mesures (blues). */
const unitBars = (t: PlayTrack) => (t.form === 'blues' ? 4 : t.perKey ?? 1);
const unitCount = (t: PlayTrack) => Math.ceil((t.bars?.length ?? 0) / unitBars(t));
function unitSpan(t: PlayTrack, u: number): [number, number] {
  const b = t.bars!;
  const first = u * unitBars(t);
  const next = first + unitBars(t);
  return [b[first] ?? 0, next < b.length ? b[next] : b[b.length - 1] + barLength(t)];
}
/** Nom d'une tonalité : la fondamentale de son dernier accord (Fmaj7 après C7sus4, Cm7 après Cmaj7). */
function unitName(t: PlayTrack, u: number): string {
  const first = u * unitBars(t);
  let i = 0;
  while (i + 1 < t.segs!.length && t.segs![i + 1][0] < first + unitBars(t)) i++;
  const c = segChords(t, i).slice(-1)[0];
  return c ? noteName(c.root) : '';
}

function Player({ t, url }: { t: PlayTrack; url: string }) {
  const audio = useMemo(() => new Audio(url), [url]);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [loop, setLoop] = useState<number | null>(null);
  const [speed, setSpeedState] = useState(() => load<Saved>('bandes', { speed: 1 }).speed);
  const setSpeed = (s: number) => (setSpeedState(s), save('bandes', { speed: s }));
  const loopRef = useRef<number | null>(null);
  loopRef.current = loop;
  const cal = isCalibrated(t);
  useWakeLock(playing);

  useEffect(() => {
    const a = audio as HTMLAudioElement & { preservesPitch?: boolean; webkitPreservesPitch?: boolean };
    a.preservesPitch = true;
    a.webkitPreservesPitch = true;
    a.preload = 'auto';
    const onEnd = () => setPlaying(false);
    a.addEventListener('ended', onEnd);
    let raf = 0;
    const tick = () => {
      if (loopRef.current !== null && cal) {
        const [s, e] = unitSpan(t, loopRef.current);
        if (a.currentTime >= e - 0.02) a.currentTime = s;
      }
      setNow(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      a.removeEventListener('ended', onEnd);
      a.pause();
    };
  }, [audio]);
  useEffect(() => {
    audio.playbackRate = speed;
  }, [audio, speed]);

  const toggle = () => {
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };
  /** Va au début d'une tonalité ou d'une mesure (un temps avant, pour l'entendre arriver). */
  const seek = (sec: number) => {
    audio.currentTime = Math.max(0, sec - barLength(t) / 4);
    setNow(audio.currentTime);
  };
  const jumpUnit = (u: number) => {
    seek(unitSpan(t, u)[0]);
    if (loop !== null) setLoop(u);
  };

  const at = cal ? chordAt(t, now) : null;
  const seg = at && at.seg >= 0 ? at.seg : 0;
  const cur = at?.chord ?? (cal ? segChords(t, 0)[0] : null);
  const tonic = t.form === 'blues' ? segChords(t, 0)[0] ?? null : null;
  const nextSeg = cal && seg + 1 < t.segs!.length ? seg + 1 : null;
  const nextChord = nextSeg !== null ? segChords(t, nextSeg).map(chordSymbol).join(' ') : null;
  const barsLeft = nextSeg !== null && at && at.bar >= 0 ? t.segs![nextSeg][0] - at.bar : null;
  const unit = at && at.bar >= 0 ? Math.floor(at.bar / unitBars(t)) : 0;
  const km = cur ? marksFor(t, cur, tonic) : null;
  const scale = cur ? SCALES[scaleFor(t, cur)] : null;
  const keysCount = cal ? unitCount(t) : 0;
  const dur = audio.duration || 0;

  return (
    <div class="screen bandes-player">
      <TopBar title={`${t.track}. ${t.title}`} back="/bandes" />
      {cal && cur ? (
        <section class="bp-now">
          <div class="bp-cur">
            <span class="bp-sym sym">{chordSymbol(cur)}</span>
            <span class="bp-scale">
              {t.form === 'blues' && tonic ? `gamme blues de ${noteName(tonic.root)}` : `gamme : ${scale?.name}`}
            </span>
          </div>
          <div class="bp-meta">
            {at && at.bar >= 0 ? (
              <span>
                {t.form === 'blues' ? `Mesure ${(at.bar % 12) + 1}/12 · chorus ${Math.floor(at.bar / 12) + 1}` : `Tonalité ${unit + 1}/${keysCount} · mesure ${(at.bar % unitBars(t)) + 1}/${unitBars(t)}`}
              </span>
            ) : (
              <span>Introduction</span>
            )}
            {nextChord && t.form !== 'blues' ? (
              <span class="bp-next">
                Ensuite : <b class="sym">{nextChord}</b>
                {barsLeft !== null ? ` dans ${barsLeft} mesure${barsLeft > 1 ? 's' : ''}` : ''}
              </span>
            ) : null}
            <span class="bp-beats" aria-hidden="true">
              {[0, 1, 2, 3].map((b) => (
                <i key={b} class={at && at.bar >= 0 && at.beat === b ? 'on' : ''} />
              ))}
            </span>
          </div>
        </section>
      ) : (
        <p class="muted">Cette piste n’est pas encore calée : tu peux l’écouter et jouer dessus, sans la grille.</p>
      )}
      {km ? <Keyboard lo={LO} hi={HI} fit marks={km.marks} labels={km.labels} /> : null}
      {cal ? (
        t.form === 'blues' ? (
          <div class="comp-grid bp-grid">
            {Array.from({ length: 12 }, (_, i) => {
              const on = at && at.bar >= 0 && at.bar % 12 === i;
              const chorus = Math.floor((at && at.bar >= 0 ? at.bar : 0) / 12);
              return (
                <button key={i} class={'comp-bar' + (on ? ' cur' : '')} onClick={() => seek(t.bars![Math.min(t.bars!.length - 1, chorus * 12 + i)])}>
                  <b class="sym">{segChords(t, i).map(chordSymbol).join(' ')}</b>
                </button>
              );
            })}
          </div>
        ) : (
          <div class="bp-keys">
            {Array.from({ length: Math.min(keysCount, 24) }, (_, u) => (
              <button key={u} class={'pchip' + (u === unit && at && at.bar >= 0 ? ' on' : '')} onClick={() => jumpUnit(u)}>
                <b>{unitName(t, u)}</b>
              </button>
            ))}
          </div>
        )
      ) : null}
      <input
        type="range"
        min={0}
        max={dur || 1}
        step={0.1}
        value={now}
        aria-label="Position"
        onInput={(e) => {
          audio.currentTime = Number((e.target as HTMLInputElement).value);
          setNow(audio.currentTime);
        }}
      />
      <p class="muted small bp-time">
        {fmt(now)} / {fmt(dur)}
      </p>
      <Segmented
        label="Vitesse"
        value={String(speed)}
        onChange={(v: string) => setSpeed(Number(v))}
        options={[
          { value: '1', label: '100 %' },
          { value: '0.9', label: '90 %' },
          { value: '0.8', label: '80 %' },
          { value: '0.75', label: '75 %' }
        ]}
      />
      <div class="thumb-zone">
        <div class="row-actions">
          {cal ? (
            <button class={'btn' + (loop !== null ? ' on' : '')} aria-pressed={loop !== null} onClick={() => setLoop(loop !== null ? null : unit)}>
              {loop !== null ? 'Arrêter la boucle' : t.form === 'blues' ? 'Boucler ces 4 mesures' : 'Boucler cette tonalité'}
            </button>
          ) : null}
          <button class="btn primary grow" onClick={toggle}>
            {playing ? <PauseIcon /> : <PlayIcon />} {playing ? 'Pause' : 'Lecture'}
          </button>
        </div>
      </div>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
