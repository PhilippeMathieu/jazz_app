// Réglages : objectif du jour, micro (test, décalage), point de départ du parcours, crédits.
import { useState } from 'preact/hooks';
import { loadDays, setGoal } from '../core/events';
import { TopBar } from '../ui/Screen';
import { Segmented } from '../ui/Segmented';
import { ConfirmButton } from '../ui/ConfirmButton';
import { ChevronIcon } from '../ui/icons';
import { offsetOf } from '../core/rhythm/offset';
import { PLACEMENTS } from './steps';
import { resetParcours, setStart, useParcours } from './progress';

const msText = (v: number | undefined) => (v === undefined ? 'pas encore réglé' : `actuel : ${v} ms`);

export function Settings() {
  const p = useParcours();
  const [goal, setG] = useState(loadDays().goalMin);
  return (
    <div class="screen">
      <TopBar title="Réglages" />
      <section>
        <h2 class="label">Objectif du jour</h2>
        <Segmented
          label="Objectif du jour"
          value={goal}
          onChange={(v: number) => (setGoal(v), setG(v))}
          options={[5, 10, 20].map((v) => ({ value: v, label: `${v} min` }))}
        />
        <p class="muted small">Temps passé à répondre (30 s au plus par réponse), 3 min par leçon. Un jour manqué par semaine ne casse pas la série.</p>
      </section>
      <section>
        <h2 class="label">Micro</h2>
        <div class="list">
          <a class="row" href="#/reglages/micro">
            <span class="row-main">
              <span class="row-title">Tester le micro</span>
              <span class="row-sub">Niveau, seuil de silence, note et accord entendus</span>
            </span>
            <ChevronIcon />
          </a>
          <a class="row" href="#/reglages/decalage">
            <span class="row-main">
              <span class="row-title">Décalage du micro</span>
              <span class="row-sub">10 secondes, pour le rythme au piano et le comping · {msText(offsetOf('mic'))}</span>
            </span>
            <ChevronIcon />
          </a>
          <a class="row" href="#/reglages/decalage/ecran">
            <span class="row-main">
              <span class="row-title">Décalage de l’écran</span>
              <span class="row-sub">10 secondes, pour taper les rythmes · {msText(offsetOf('tap'))}</span>
            </span>
            <ChevronIcon />
          </a>
        </div>
      </section>
      <section>
        <h2 class="label">Point de départ du parcours</h2>
        <Segmented label="Point de départ" value={p.start} onChange={(v: number) => setStart(v)} options={PLACEMENTS.map((pl) => ({ value: pl.step, label: `Étape ${pl.step + 1}`, sub: pl.label }))} />
        <p class="muted small">Les étapes d’avant sont comptées comme acquises ; tu peux toujours les ouvrir.</p>
        <ConfirmButton label="Tout recommencer (effacer le parcours)" confirm="Toucher encore pour confirmer" onConfirm={resetParcours} />
      </section>
      <p class="credits">
        Piano : Salamander Grand Piano, Alexander Holm,{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">
          CC BY 3.0
        </a>
        . Contrebasse : soundfont Musyng Kite,{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">
          CC BY-SA 3.0
        </a>
        . Batterie : Versilian Community Sample Library, CC0. Notation : police Bravura (Steinberg), SIL OFL 1.1. Grilles d’accords uniquement.
      </p>
    </div>
  );
}
