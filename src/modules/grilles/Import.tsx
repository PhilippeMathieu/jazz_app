import { useMemo, useState } from 'preact/hooks';
import { chartFromImport, importText } from '../../core/chart/import';
import { Key, Style, keyLabel, keyOnPc } from '../../core/chart/model';
import { chordSymbol } from '../../core/theory/chords';
import { pcOf } from '../../core/theory/notes';
import { newChartId, saveUserChart } from '../../library/userCharts';
import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';

const EXAMPLE = `Capo: 2nd fret
Key: Am

[Intro]
Dm7  G7  Cmaj7  Fmaj7

[Verse 1]
Dm7               G7
The falling leaves drift by the window
Bm7b5    E7(b9)   Am
The autumn leaves of red and gold`;

const KEYS: { value: string; label: string }[] = [];
for (const mode of ['major', 'minor'] as const) for (let pc = 0; pc < 12; pc++) KEYS.push({ value: `${pc}-${mode}`, label: keyLabel(keyOnPc(pc, mode)) });

export function Import() {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [keyOverride, setKeyOverride] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>('swing');
  const [tempo, setTempo] = useState(120);
  const [error, setError] = useState('');
  const [applyCapo, setApplyCapo] = useState(true);

  const result = useMemo(() => (text.trim() ? importText(text, { applyCapo }) : null), [text, applyCapo]);
  const guessed = result ? `${pcOf(result.key.tonic)}-${result.key.mode}` : '';
  const keyValue = keyOverride ?? guessed;
  const key: Key | undefined = result
    ? keyValue === guessed
      ? result.key
      : keyOnPc(Number(keyValue.split('-')[0]), keyValue.split('-')[1] as 'major' | 'minor')
    : undefined;

  const saveIt = () => {
    if (!result || !result.bars.length) return;
    const id = newChartId();
    const chart = chartFromImport(result, { id, title: title.trim() || result.title || 'Grille importée', key, tempo: result.tempo ?? tempo, style });
    if (!saveUserChart(chart)) {
      setError('Enregistrement impossible : le stockage de ce navigateur est plein ou bloqué.');
      return;
    }
    go(`/grille/${id}`);
  };

  return (
    <div class="screen">
      <div class="topbar">
        <button class="back" aria-label="Retour" onClick={() => go('/grilles')}><BackIcon /></button>
        <h1>Importer</h1>
      </div>
      <p class="muted small" style="margin:0">
        Colle les accords d'un morceau, avec ou sans paroles. Depuis Ultimate Guitar : ouvre le morceau sur ultimate-guitar.com dans Safari,
        sélectionne tout le texte des accords et copie-le. Les fichiers ChordPro sont aussi acceptés. Si la copie est bloquée dans l'appli, fais
        une capture d'écran, ouvre-la dans Photos, appuie longuement sur le texte (Texte en direct) puis Copier.
      </p>

      <div class="field">
        <label for="imp-title">Titre</label>
 <input id="imp-title" type="text" value={title} placeholder={result?.title ?? 'Ex. Autumn Leaves'} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
      </div>
      <div class="field">
        <label for="imp-text">Accords</label>
        <textarea id="imp-text" rows={9} value={text} placeholder={EXAMPLE} spellcheck={false} autocapitalize="off" autocorrect="off"
          onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setKeyOverride(null); }} />
        {!text ? <button class="linkbtn" onClick={() => setText(EXAMPLE)}>Essayer avec un exemple</button> : null}
      </div>

      {result ? (
        <div class="chord-card">
          {result.bars.length ? (
            <>
              <p>
                <b>{result.bars.length} mesures</b> · tonalité devinée : <b>{keyLabel(result.key)}</b>
              </p>
              <div class="notes">
                {result.bars
                  .slice(0, 32)
                  .map((b) => b.chords.map((c) => chordSymbol(c.chord)).join(' '))
                  .join('  |  ')}
                {result.bars.length > 32 ? '  …' : ''}
              </div>
              {result.capo ? (
                <label class="check">
                  <input id="imp-capo" type="checkbox" checked={applyCapo} onChange={(e) => setApplyCapo((e.target as HTMLInputElement).checked)} />
                  <span>
                    Capo {result.capo} détecté. Transposer les accords à la hauteur réelle pour le piano (+{result.capo} demi-ton
                    {result.capo > 1 ? 's' : ''}).
                  </span>
                </label>
              ) : null}
              {!result.measured ? <p class="muted small">Pas de barres de mesure : chaque accord occupe une mesure. Ajoute des « | » pour préciser.</p> : null}
            </>
          ) : (
            <p>Aucun accord reconnu pour l'instant.</p>
          )}
          {result.unknown.length ? <p class="small" style="color:var(--bad)">Non reconnus (ignorés) : {result.unknown.slice(0, 8).join(', ')}</p> : null}
          <div class="field-row">
            <div class="field k">
              <label for="imp-key">Tonalité</label>
              <select id="imp-key" value={keyValue} onChange={(e) => setKeyOverride((e.target as HTMLSelectElement).value)}>
                {KEYS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div class="field">
              <label for="imp-style">Style</label>
              <select id="imp-style" value={style} onChange={(e) => setStyle((e.target as HTMLSelectElement).value as Style)}>
                <option value="swing">Swing</option>
                <option value="bossa">Bossa</option>
                <option value="blues">Blues</option>
              </select>
            </div>
            <div class="field t">
              <label for="imp-tempo">Tempo</label>
              <input id="imp-tempo" type="number" min={40} max={280} value={tempo} onInput={(e) => setTempo(Number((e.target as HTMLInputElement).value) || 120)} />
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p class="small" style="color:var(--bad);margin:0">{error}</p> : null}
      <button class="next" disabled={!result || !result.bars.length} onClick={saveIt}>Enregistrer et ouvrir</button>
      <p class="muted small" style="margin:0">Tes grilles restent sur ce téléphone, dans cette appli.</p>
    </div>
  );
}
