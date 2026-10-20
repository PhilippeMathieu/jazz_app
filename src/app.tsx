import { useRoute } from './ui/router';
import { Home } from './Home';
import { ChartList } from './modules/grilles/ChartList';
import { ChartView } from './modules/grilles/ChartView';
import { Import } from './modules/grilles/Import';
import { Oreille } from './modules/oreille/Oreille';
import { Express } from './modules/express/Express';
import { Tonalite } from './modules/tonalite/Tonalite';
import { Lecture } from './modules/lecture/Lecture';
import { CoursList, LessonView } from './modules/cours/Cours';
import { TipsView } from './modules/cours/Tips';
import { Clavier } from './modules/clavier/Clavier';
import { Rythme } from './modules/rythme/Rythme';
import { Progres } from './modules/progres/Progres';
import { Flash } from './modules/flash/Flash';
import { Micro } from './modules/micro/Micro';
import { chartById } from './library/charts';

export function App() {
  const [page, a, b] = useRoute();
  if (page === 'grilles' || page === 'impro') {
    // Anciennes adresses « impro/gammes/<grille> » : la grille s'ouvre en mode Gammes ou Guide tones.
    const c = page === 'impro' && b ? chartById(b) : undefined;
    if (c) return <ChartView key={c.id + a} chart={c} initialMode={a === 'guide' ? 'guide' : 'gammes'} />;
    return <ChartList />;
  }
  if (page === 'importer') return <Import />;
  if (page === 'grille') {
    const c = a ? chartById(a) : undefined;
    return c ? <ChartView key={c.id + (b ?? '')} chart={c} initialMode={b === 'analyser' ? 'analyser' : undefined} /> : <ChartList />;
  }
  if (page === 'express') return <Express />;
  if (page === 'cours') return a === 'astuces' ? <TipsView /> : a ? <LessonView key={a} id={a} /> : <CoursList />;
  if (page === 'clavier') return <Clavier />;
  if (page === 'progres') return <Progres />;
  if (page === 'rythme') return <Rythme key={(a ?? '') + (b ?? '')} piano={a === 'piano'} preset={a && a !== 'piano' ? { exercise: a, level: b && b !== 'confusions' ? Number(b) - 1 : -1, confusions: b === 'confusions' } : undefined} />;
  if (page === 'lecture') return <Lecture />;
  if (page === 'tonalite') return <Tonalite />;
  if (page === 'oreille') return <Oreille key={a ?? ''} preset={a} />;
  if (page === 'flash') return <Flash />;
  if (page === 'micro') return <Micro />;
  return <Home />;
}
