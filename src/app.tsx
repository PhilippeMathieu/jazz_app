import { useRoute } from './ui/router';
import { Home } from './Home';
import { ChartList } from './modules/grilles/ChartList';
import { ChartView } from './modules/grilles/ChartView';
import { Import } from './modules/grilles/Import';
import { Oreille } from './modules/oreille/Oreille';
import { Express } from './modules/express/Express';
import { Tonalite } from './modules/tonalite/Tonalite';
import { Lecture } from './modules/lecture/Lecture';
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
    return c ? <ChartView key={c.id} chart={c} /> : <ChartList />;
  }
  if (page === 'express') return <Express />;
  if (page === 'lecture') return <Lecture />;
  if (page === 'tonalite') return <Tonalite />;
  if (page === 'oreille') return <Oreille />;
  if (page === 'flash') return <Flash />;
  if (page === 'micro') return <Micro />;
  return <Home />;
}
