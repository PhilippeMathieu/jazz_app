// Lance la brique d'un exercice du parcours avec son réglage, sans écran de réglages.
import { JSX } from 'preact';
import { Run, Where } from './steps';
import { LectureRun } from '../modules/lecture/Lecture';
import { TonaliteRun } from '../modules/tonalite/Tonalite';
import { ArmuresRun } from '../modules/armures/Armures';
import { ExpressRun } from '../modules/express/Express';
import { ReharmRun } from '../modules/express/Reharm';
import { OreilleRun } from '../modules/oreille/Oreille';
import { FlashRun } from '../modules/flash/Flash';
import { CompingRun } from '../modules/flash/Comping';
import { PhraseRun } from '../modules/phrases/Phrases';
import { ChartView } from '../modules/grilles/ChartView';
import { RythmeRun } from '../modules/rythme/Rythme';
import { chartById } from '../library/charts';

/** total : nombre de réponses de la série (pour l'affichage du compteur). where : au piano, le micro écoute. */
export function renderRun(run: Run, total: number, onExit: () => void, where: Where = 'metro'): JSX.Element | null {
  switch (run.kind) {
    case 'lecture':
      return <LectureRun level={run.level} answer={run.answer} total={total} onExit={onExit} />;
    case 'tonalite':
      return <TonaliteRun level={run.level} total={total} onExit={onExit} />;
    case 'armures':
      return <ArmuresRun level={run.level} total={total} onExit={onExit} />;
    case 'express':
      return <ExpressRun level={run.level} total={total} onExit={onExit} />;
    case 'reharm':
      return <ReharmRun level={run.level} onExit={onExit} />;
    case 'ear':
      return <OreilleRun mode={run.mode} level={run.level} pair={run.pair} onExit={onExit} />;
    case 'full':
    case 'iv':
    case 'bass':
      return <OreilleRun mode={run.kind} level={run.level} onExit={onExit} />;
    case 'flash':
      return <FlashRun type={run.type} order={run.order} level={run.level} onExit={onExit} />;
    case 'comping':
      return <CompingRun level={run.level} voicing={run.voicing} onExit={onExit} />;
    case 'phrase':
      return <PhraseRun line={run.line} onExit={onExit} />;
    case 'chart': {
      const chart = chartById(run.chart);
      return chart ? <ChartView chart={chart} initialMode={run.mode} onBack={onExit} memLevel={run.memLevel} /> : null;
    }
    case 'rythme':
      return <RythmeRun exercise={run.exercise} level={run.level} input={where === 'piano' ? 'mic' : 'tap'} onExit={onExit} />;
  }
}
