// Importer une grille copiée (Ultimate Guitar, ChordPro, texte libre).
import { useMemo, useState } from 'preact/hooks';
import { chartFromImport, importText } from '../../core/chart/import';
import { Key, Style, keyLabel, keyOnPc } from '../../core/chart/model';
import { chordSymbol } from '../../core/theory/chords';
import { pcOf } from '../../core/theory/notes';
import { newChartId, saveUserChart } from '../../library/userCharts';
import { TopBar } from '../../ui/Screen';
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
  const [tempo, setTempo] = useState<number | null>(null);
  const [applyCapo, setApplyCapo] = useState(true);
  const [error, setError] = useState('');

  const result = useMemo(() => (text.trim() ? importText(text, { applyCapo }) : null), [text, applyCapo]);
  const guessed = result ? `${pcOf(result.key.tonic)}-${result.key.mode}` : '';
  const keyValue = keyOverride ?? guessed;
  const key: Key | undefined = result ? (keyValue === guessed ? result.key : keyOnPc(Number(keyValue.split('-')[0]), keyValue.split('-')[1] as 'major' | 'minor')) : undefined;
  const effTempo = tempo ?? result?.tempo ?? 120;

  const saveIt = () => {
    if (!result || !result.bars.length) return;
    const id = newChartId();
    const chart = chartFromImport(result, { id, title: title.trim() || result.title || 'Grille importée', key, tempo: effTempo, style });
    if (!saveUserChart(chart)) {
      setError('Enregistrement impossible : le stockage de ce navigateur est plein ou bloqué.');
      return;
    }
    go(`/grille/${id}`);
  };

  return (
    <div class="screen">
      <TopBar title="Importer une grille" back="/grilles" />
      <p class="intro">Colle les accords d’un morceau, avec ou sans paroles : Ultimate Guitar, ChordPro ou texte libre.</p>
      <details class="help">
        <summary>Copie bloquée dans l’appli ?</summary>
        <p class="muted small">
          Ouvre le morceau sur ultimate-guitar.com dans Safari et copie le texte. Ou fais une capture d’écran, ouvre-la dans Photos, appuie
          longuement sur le texte (Texte en direct) puis Copier.
        </p>
      </details>

      <label class="field">
        <span>Titre</span>
        <input id="imp-title" type="text" value={title} placeholder={result?.title ?? 'Sans titre'} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field">
        <span>Accords</span>
        <textarea
          id="imp-text"
          rows={9}
          value={text}
          spellcheck={false}
          autocapitalize="off"
          autocorrect="off"
          onInput={(e) => {
            setText((e.target as HTMLTextAreaElement).value);
            setKeyOverride(null);
          }}
        />
      </label>
      {!text ? (
        <button class="linkbtn" onClick={() => setText(EXAMPLE)}>
          Essayer avec un exemple
        </button>
      ) : null}

      {result ? (
        <section class="panel">
          {result.bars.length ? (
            <>
              <p>
                <b>{result.bars.length} mesures</b> · tonalité devinée : <b>{keyLabel(result.key)}</b>
              </p>
              <p class="mono small muted">
                {result.bars
                  .slice(0, 32)
                  .map((b) => b.chords.map((c) => chordSymbol(c.chord)).join(' '))
                  .join('  |  ')}
                {result.bars.length > 32 ? '  …' : ''}
              </p>
              {result.capo ? (
                <label class="toggle">
                  <input id="imp-capo" type="checkbox" checked={applyCapo} onChange={() => setApplyCapo(!applyCapo)} />
                  <span>Capo {result.capo} : transposer à la hauteur réelle (+{result.capo})</span>
                </label>
              ) : null}
              {!result.measured ? <p class="muted small">Sans barres « | », chaque accord occupe une mesure.</p> : null}
            </>
          ) : (
            <p>Aucun accord reconnu pour l’instant.</p>
          )}
          {result.unknown.length ? <p class="small bad">Non reconnus (ignorés) : {result.unknown.slice(0, 8).join(', ')}</p> : null}
          <div class="field-row">
            <label class="field k">
              <span>Tonalité</span>
              <select id="imp-key" value={keyValue} onChange={(e) => setKeyOverride((e.target as HTMLSelectElement).value)}>
                {KEYS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label class="field">
              <span>Style</span>
              <select id="imp-style" value={style} onChange={(e) => setStyle((e.target as HTMLSelectElement).value as Style)}>
                <option value="swing">Swing</option>
                <option value="bossa">Bossa</option>
                <option value="blues">Blues</option>
                <option value="ballade">Ballade</option>
              </select>
            </label>
            <label class="field t">
              <span>Tempo</span>
              <input id="imp-tempo" type="number" min={40} max={300} value={effTempo} onInput={(e) => setTempo(Number((e.target as HTMLInputElement).value) || null)} />
            </label>
          </div>
        </section>
      ) : null}

      {error ? <p class="small bad">{error}</p> : null}
      <button class="btn primary block" disabled={!result || !result.bars.length} onClick={saveIt}>
        Enregistrer et ouvrir
      </button>
      <p class="muted small">Tes grilles restent sur ce téléphone.</p>
    </div>
  );
}
