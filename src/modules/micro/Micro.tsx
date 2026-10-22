// Tester le micro : ce que l'appli entend (niveau, note, accord), la sensibilité, et un enregistrement de diagnostic.
import { useState } from 'preact/hooks';
import { MIC_MESSAGES, micLevel, micSettings, readChord, readMono, recordRaw, saveMicSettings, useMicLoop, useMicRelease, useMicState, wavOf } from '../../core/listen/mic';
import { LIMITS } from '../../core/listen/detect';
import { plainName } from '../../core/theory/notes';
import { TopBar } from '../../ui/Screen';
import { MicPill } from '../../ui/MicPill';
import { Segmented } from '../../ui/Segmented';

const PCS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const octaveName = (m: number) => `${plainName(m)}${Math.floor(m / 12) - 1}`;
const dbfs = (x: number) => 20 * Math.log10(Math.max(x, 1e-7));
/** Position sur le vumètre : −70 dB à gauche, 0 dB à droite. */
const pos = (x: number) => Math.max(0, Math.min(1, (dbfs(x) + 70) / 70));
const SENS = [
  { value: 0.6, label: 'Moins', sub: 'Si l’appli entend des notes que tu ne joues pas' },
  { value: 1, label: 'Normale', sub: 'Réglée sur le bruit de la pièce' },
  { value: 1.8, label: 'Plus', sub: 'Si des notes jouées doucement ne sont pas entendues' }
];
const REC_S = 15;

export function Micro() {
  const st = useMicState();
  useMicRelease();
  const [sens, setSens] = useState(micSettings().sens);
  const [lv, setLv] = useState(micLevel);
  const [mono, setMono] = useState<{ level: number; midi: number | null; cents: number }>({ level: 0, midi: null, cents: 0 });
  const [ch, setCh] = useState<{ chroma: Float32Array; lowest: number | null } | null>(null);
  const [rec, setRec] = useState<{ phase: 'idle' | 'run' | 'done'; s: number; url?: string; file?: File }>({ phase: 'idle', s: 0 });

  useMicLoop(st === 'on', () => {
    setLv(micLevel());
    const m = readMono();
    if (m) {
      const p = m.pitch && m.pitch.clarity > 0.85 ? m.pitch : null;
      setMono({ level: m.level, midi: p ? Math.round(p.midi) : null, cents: p ? Math.round((p.midi - Math.round(p.midi)) * 100) : 0 });
    }
    const c = readChord();
    // Comme les exercices : une note attendue est « là » d'après le chroma au retrait d'harmoniques adouci.
    setCh(c?.analysis ? { chroma: c.analysis.soft.slice(), lowest: c.analysis.lowest } : null);
  }, 100);

  const record = async () => {
    setRec({ phase: 'run', s: 0 });
    const r = await recordRaw(REC_S, (s) => setRec((x) => (x.phase === 'run' ? { ...x, s } : x)));
    if (!r) return setRec({ phase: 'idle', s: 0 });
    const blob = wavOf(r.data, r.sampleRate);
    const name = `micro-piano-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.wav`;
    setRec({ phase: 'done', s: REC_S, url: URL.createObjectURL(blob), file: new File([blob], name, { type: 'audio/wav' }) });
  };
  const share = async () => {
    const f = rec.file;
    if (!f) return;
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: 'Micro : enregistrement de diagnostic' });
      } catch {
        /* partage annulé */
      }
    }
  };

  const heard = ch ? PCS.filter((_, i) => ch.chroma[i] >= LIMITS.presentSoft) : [];
  const gainDb = Math.round(20 * Math.log10(lv.gain));
  const canShare = typeof navigator.share === 'function';
  return (
    <div class="screen">
      <TopBar title="Micro" back="/reglages" actions={<MicPill />} />
      <p class="intro">Téléphone sur le pupitre, micro (bas du téléphone) vers le piano. Joue une note, puis un accord, à ton volume habituel.</p>
      {st !== 'on' ? <p class="muted">{st === 'off' ? 'Active le micro avec le bouton en haut à droite.' : MIC_MESSAGES[st]}</p> : null}
      {st === 'on' ? (
        <>
          <section class="panel">
            <h2 class="label">Niveau</h2>
            <div class="meter">
              <span style={`width:${pos(mono.level) * 100}%`} />
              <i style={`left:${pos(lv.gate) * 100}%`} />
            </div>
            <p class="muted small">
              Le trait orange est le seuil : au-dessus, l’appli écoute. Il se règle tout seul sur le bruit de la pièce (bruit de fond {Math.round(dbfs(lv.floor))} dB, amplification +{gainDb} dB).
            </p>
            <Segmented
              label="Sensibilité"
              value={sens}
              onChange={(v: number) => {
                setSens(v);
                saveMicSettings({ sens: v });
              }}
              options={SENS}
            />
          </section>
          <section class="panel">
            <h2 class="label">Une note (main droite)</h2>
            <p class="mic-note">
              <b>{mono.midi !== null ? octaveName(mono.midi) : '–'}</b>
              <span class="muted">{mono.midi !== null ? `${mono.cents > 0 ? '+' : ''}${mono.cents} cents` : 'Joue une note'}</span>
            </p>
          </section>
          <section class="panel">
            <h2 class="label">Un accord</h2>
            <div class="chroma">
              {PCS.map((n, i) => {
                const v = ch ? ch.chroma[i] : 0;
                return (
                  <div key={n} class={'cbar' + (v >= LIMITS.presentSoft ? ' on' : '')}>
                    <span style={`height:${Math.round(v * 100)}%`} />
                    <small>{n}</small>
                  </div>
                );
              })}
            </div>
            <p class="small">
              {heard.length ? (
                <>
                  Entendu : <b class="mono">{heard.join(' ')}</b>
                  {ch?.lowest != null ? <span class="muted"> · note grave {octaveName(ch.lowest)}</span> : null}
                </>
              ) : (
                <span class="muted">Joue un accord et laisse-le sonner.</span>
              )}
            </p>
          </section>
          <section class="panel">
            <h2 class="label">Ça ne marche toujours pas ?</h2>
            <p class="small">
              Enregistre {REC_S} secondes de ce que l’appli entend : quelques notes seules, puis quelques accords, à ton volume habituel. Envoie le fichier à Claude : la détection sera réglée sur ton piano et ton téléphone.
            </p>
            {rec.phase === 'run' ? (
              <p class="verdict">
                <i class="rec" /> Enregistrement… {Math.floor(rec.s)} / {REC_S} s
              </p>
            ) : rec.phase === 'done' && rec.file ? (
              <div class="row-actions">
                {canShare ? (
                  <button class="btn primary" onClick={share}>
                    Envoyer le fichier
                  </button>
                ) : null}
                <a class="btn" href={rec.url} download={rec.file.name}>
                  Télécharger
                </a>
                <button class="btn ghost" onClick={record}>
                  Recommencer
                </button>
              </div>
            ) : (
              <button class="btn" onClick={record}>
                Enregistrer {REC_S} s
              </button>
            )}
          </section>
          <p class="muted small">Pour jouer avec l’accompagnement, mets des écouteurs : sinon le micro entend aussi le haut-parleur.</p>
        </>
      ) : null}
    </div>
  );
}
