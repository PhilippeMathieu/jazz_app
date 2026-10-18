import { useRoute } from './ui/router';
import { Home } from './Home';
import { ChartList } from './modules/grilles/ChartList';
import { ChartView } from './modules/grilles/ChartView';
import { Oreille } from './modules/oreille/Oreille';
import { Impro } from './modules/impro/Impro';
import { chartById } from './library/charts';

export function App() {
  const [page, arg] = useRoute();
  if (page === 'grilles') return <ChartList />;
  if (page === 'grille') {
    const c = arg ? chartById(arg) : undefined;
    return c ? <ChartView key={c.id} chart={c} /> : <ChartList />;
  }
  if (page === 'oreille') return <Oreille />;
  if (page === 'impro') return <Impro />;
  return <Home />;
}
