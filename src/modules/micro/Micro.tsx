// Réglage et test du micro : vérifier que l'appli entend bien le piano.
import { useRef, useState } from 'preact/hooks';
import { MIC_MESSAGES, micSettings, readChord, readMono, saveMicSettings, startMic, stopMic, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { LIMITS } from '../../core/listen/detect';
import { plainName } from '../../core/theory/notes';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';

const PCS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const octaveName = (m: number) => `${plainName(m)}${Math.floor(m / 12) - 1}`;
const db = (x: number) => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(x, 1e-6)) + 70) / 70));

/** Bouton d'activation du micro, réutilisé dans les exercices. */
export function MicToggle({ onChange }: { onChange?: (on: boolean) => void }) {
  const st = useMicState();
  const on = st === 'on';
  return (
    <div class="mic-toggle">
      <button
        class={'btn' + (on ? ' primary' : '')}
        aria-pressed={on}
        onClick={async () => {
          if (on) {
            stopMic();
            onChange?.(false);
          } else {
            // Attention : onChange?.(await startMic()) n'appellerait pas startMic sans onChange.
            const ok = await startMic();
            onChange?.(ok);
          }
        }}
      >
        {on ? 'Micro activé' : st === 'asking' ? 'Autorisation…' : 'Écouter mon piano'}
      </button>
      {st === 'denied' || st === 'error' || st === 'unsupported' ? <span class="small" style="color:var(--bad)">{MIC_MESSAGES[st]}</span> : null}
    </div>
  );
}

export function Micro() {
  const st = useMicState();
  useMicRelease();
  const [settings, setSettings] = useState(micSettings);
  const [mono, setMono] = useState<{ level: number; midi: number | null; cents: number; clarity: number }>({ level: 0, midi: null, cents: 0, clarity: 0 });
  const [ch, setCh] = useState<{ level: number; chroma: Float32Array; lowest: number | null } | null>(null);
  const calib = useRef<number[] | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  useMicLoop(st === 'on', () => {
    const m = readMono();
    if (m) {
      const p = m.pitch && m.level >= settings.gate && m.pitch.clarity > 0.85 ? m.pitch : null;
      setMono({ level: m.level, midi: p ? Math.round(p.midi) : null, cents: p ? Math.round((p.midi - Math.round(p.midi)) * 100) : 0, clarity: p?.clarity ?? 0 });
      if (calib.current) calib.current.push(m.level);
    }
    const c = readChord();
    if (c) setCh({ level: c.level, chroma: c.chroma, lowest: c.lowest });
  }, 100);

  const measureSilence = () => {
    calib.current = [];
    setCalibrating(true);
    window.setTimeout(() => {
      const levels = calib.current ?? [];
      calib.current = null;
      setCalibrating(false);
      if (!levels.length) return;
      const max = Math.max(...levels);
      const gate = Math.min(0.05, Math.max(0.002, max * 2.5));
      const s = { ...settings, gate };
      setSettings(s);
      saveMicSettings(s);
    }, 1500);
  };

  const heard = ch && ch.level >= settings.gate ? PCS.filter((_, i) => ch.chroma[i] >= LIMITS.present) : [];

  return (
    <div class="screen">
      <div class="topbar">
        <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
        <h1>Micro</h1>
      </div>
      <p class="muted small" style="margin:0">
        Pose le téléphone sur le pupitre, micro (bas de l'iPhone) vers le piano. Joue une note, puis un accord : vérifie que l'appli entend les
        bonnes notes. Pour jouer avec l'accompagnement, mets des écouteurs : sinon le micro entend aussi le haut-parleur.
      </p>
      <MicToggle />
      {st !== 'on' ? <p class="muted small" style="margin:0">{MIC_MESSAGES[st]}</p> : null}

      {st === 'on' ? (
        <>
          <section class="mic-card">
            <span class="eyebrow">Niveau</span>
            <div class="meter">
              <span style={`width:${db(mono.level) * 100}%`} />
              <i style={`left:${db(settings.gate) * 100}%`} title="Seuil" />
            </div>
            <div class="mic-row">
              <button class="btn" disabled={calibrating} onClick={measureSilence}>
                {calibrating ? 'Silence, mesure en cours…' : 'Mesurer le silence'}
              </button>
              <label class="small muted" for="gate">Sensibilité</label>
              <input
                id="gate"
                type="range"
                min={0}
                max={100}
                value={Math.round(100 - db(settings.gate) * 100)}
                onInput={(e) => {
                  const v = 100 - Number((e.target as HTMLInputElement).value);
                  const gate = Math.pow(10, ((v / 100) * 70 - 70) / 20);
                  const s = { ...settings, gate };
                  setSettings(s);
                  saveMicSettings(s);
                }}
              />
            </div>
          </section>

          <section class="mic-card">
            <span class="eyebrow">Note seule (main droite)</span>
            <div class="mic-note">
              <b>{mono.midi !== null ? octaveName(mono.midi) : '—'}</b>
              {mono.midi !== null ? <span class="muted">{mono.cents > 0 ? '+' : ''}{mono.cents} cents</span> : <span class="muted">Joue une note</span>}
            </div>
          </section>

          <section class="mic-card">
            <span class="eyebrow">Notes d'un accord</span>
            <div class="chroma">
              {PCS.map((n, i) => {
                const v = ch && ch.level >= settings.gate ? ch.chroma[i] : 0;
                return (
                  <div key={n} class={'cbar' + (v >= LIMITS.present ? ' on' : '')}>
                    <span style={`height:${Math.round(v * 100)}%`} />
                    <small>{n}</small>
                  </div>
                );
              })}
            </div>
            <p class="small" style="margin:0">
              {heard.length ? (
                <>
                  Entendu : <b>{heard.join(' ')}</b>
                  {ch?.lowest != null ? <span class="muted"> · note grave {octaveName(ch.lowest)}</span> : null}
                </>
              ) : (
                <span class="muted">Joue un accord et laisse-le sonner.</span>
              )}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
