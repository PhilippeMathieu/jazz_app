// Tester et régler le micro : vérifier que l'appli entend bien le piano.
import { useRef, useState } from 'preact/hooks';
import { MIC_MESSAGES, micSettings, readChord, readMono, saveMicSettings, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { LIMITS } from '../../core/listen/detect';
import { plainName } from '../../core/theory/notes';
import { TopBar } from '../../ui/Screen';
import { MicPill } from '../../ui/MicPill';

const PCS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const octaveName = (m: number) => `${plainName(m)}${Math.floor(m / 12) - 1}`;
const db = (x: number) => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(x, 1e-6)) + 70) / 70));

export function Micro() {
  const st = useMicState();
  useMicRelease();
  const [settings, setSettings] = useState(micSettings);
  const [mono, setMono] = useState<{ level: number; midi: number | null; cents: number }>({ level: 0, midi: null, cents: 0 });
  const [ch, setCh] = useState<{ chroma: Float32Array; lowest: number | null } | null>(null);
  const calib = useRef<number[] | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  useMicLoop(st === 'on', () => {
    const m = readMono(settings.gate);
    if (m) {
      const p = m.pitch && m.pitch.clarity > 0.85 ? m.pitch : null;
      setMono({ level: m.level, midi: p ? Math.round(p.midi) : null, cents: p ? Math.round((p.midi - Math.round(p.midi)) * 100) : 0 });
      if (calib.current) calib.current.push(m.level);
    }
    const c = readChord(settings.gate);
    setCh(c?.analysis ? { chroma: c.analysis.chroma.slice(), lowest: c.analysis.lowest } : null);
  }, 100);

  const measureSilence = () => {
    calib.current = [];
    setCalibrating(true);
    window.setTimeout(() => {
      const levels = calib.current ?? [];
      calib.current = null;
      setCalibrating(false);
      if (!levels.length) return;
      const s = { ...settings, gate: Math.min(0.05, Math.max(0.002, Math.max(...levels) * 2.5)) };
      setSettings(s);
      saveMicSettings(s);
    }, 1500);
  };

  const heard = ch ? PCS.filter((_, i) => ch.chroma[i] >= LIMITS.present) : [];
  return (
    <div class="screen">
      <TopBar title="Micro" back="/reglages" actions={<MicPill />} />
      <p class="intro">Téléphone sur le pupitre, micro (bas de l’iPhone) vers le piano. Joue une note, puis un accord.</p>
      {st !== 'on' ? <p class="muted">{st === 'off' ? 'Active le micro avec le bouton en haut à droite.' : MIC_MESSAGES[st]}</p> : null}
      {st === 'on' ? (
        <>
          <section class="panel">
            <h2 class="label">Niveau</h2>
            <div class="meter">
              <span style={`width:${db(mono.level) * 100}%`} />
              <i style={`left:${db(settings.gate) * 100}%`} />
            </div>
            <div class="row-actions">
              <button class="btn" disabled={calibrating} onClick={measureSilence}>
                {calibrating ? 'Silence…' : 'Mesurer le silence'}
              </button>
              <label class="field inline" for="gate">
                <span>Sensibilité</span>
                <input
                  id="gate"
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(100 - db(settings.gate) * 100)}
                  onInput={(e) => {
                    const v = 100 - Number((e.target as HTMLInputElement).value);
                    const s = { ...settings, gate: Math.pow(10, ((v / 100) * 70 - 70) / 20) };
                    setSettings(s);
                    saveMicSettings(s);
                  }}
                />
              </label>
            </div>
            <p class="muted small">Le trait orange est le seuil : sous ce niveau, l’appli considère qu’il n’y a pas de son.</p>
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
                  <div key={n} class={'cbar' + (v >= LIMITS.present ? ' on' : '')}>
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
          <p class="muted small">Pour jouer avec l’accompagnement, mets des écouteurs : sinon le micro entend aussi le haut-parleur.</p>
        </>
      ) : null}
    </div>
  );
}
