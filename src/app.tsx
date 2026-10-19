import { useRoute } from './ui/router';
import { Home } from './Home';
import { ChartList } from './modules/grilles/ChartList';
import { ChartView } from './modules/grilles/ChartView';
import { Import } from './modules/grilles/Import';
import { Oreille } from './modules/oreille/Oreille';
import { Impro } from './modules/impro/Impro';
import { ImproView } from './modules/impro/ImproView';
import { Express } from './modules/express/Express';
import { Flash } from './modules/flash/Flash';
import { Micro } from './modules/micro/Micro';
import { chartById } from './library/charts';

export function App() {
  const [page, a, b] = useRoute();
  if (page === 'grilles') return <ChartList />;
  if (page === 'importer') return <Import />;
  if (page === 'grille') {
    const c = a ? chartById(a) : undefined;
    return c ? <ChartView key={c.id} chart={c} /> : <ChartList />;
  }
  if (page === 'express') return <Express />;
  if (page === 'flash') return <Flash />;
  if (page === 'micro') return <Micro />;
  if (page === 'oreille') return <Oreille />;
  if (page === 'impro') {
    const c = b ? chartById(b) : undefined;
    if (c && (a === 'gammes' || a === 'guide')) return <ImproView key={c.id} chart={c} mode={a} />;
    return <Impro />;
  }
  return <Home />;
}
