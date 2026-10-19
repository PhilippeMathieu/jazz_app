// Grilles importées par l'utilisateur, enregistrées sur l'appareil (format texte).
import { Chart, chartToText, parseChart } from '../core/chart/model';

interface Stored {
  id: string;
  text: string;
  created: number;
}
const KEY = 'hj:mes-grilles';

function read(): Stored[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is Stored => typeof x?.id === 'string' && typeof x?.text === 'string') : [];
  } catch {
    return [];
  }
}
function write(list: Stored[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function userCharts(): Chart[] {
  return read()
    .map((s) => {
      try {
        return parseChart(s.text, s.id);
      } catch {
        return null;
      }
    })
    .filter((c): c is Chart => c !== null);
}

export function saveUserChart(chart: Chart): boolean {
  const list = read().filter((s) => s.id !== chart.id);
  list.unshift({ id: chart.id, text: chartToText(chart), created: Date.now() });
  return write(list);
}

export function deleteUserChart(id: string) {
  write(read().filter((s) => s.id !== id));
}

export const newChartId = () => 'u-' + Date.now().toString(36);
