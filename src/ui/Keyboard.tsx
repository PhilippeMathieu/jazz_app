import { useEffect, useRef } from 'preact/hooks';
import { isBlackKey } from '../core/theory/notes';

export type Mark = 'hit' | 'sel' | 'ok' | 'bad' | 'miss' | 'soft';
interface Props {
  lo: number;
  hi: number;
  marks?: Record<number, Mark>;
  labels?: Record<number, string>;
  /** Clavier jouable : s'adapte à la largeur et renvoie la touche pressée. */
  onKey?: (midi: number) => void;
  /** Centre le défilement sur ces notes (clavier large). */
  center?: number[];
  /** Occupe toute la largeur disponible. */
  fit?: boolean;
}

const W = 22;
const H = 100;
const BW = 14;
const BH = 62;

export function Keyboard({ lo, hi, marks = {}, labels = {}, onKey, center, fit }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const whites: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) whites.push(m);
  const xw = new Map<number, number>();
  whites.forEach((m, i) => xw.set(m, i * W));
  const width = whites.length * W;

  useEffect(() => {
    if (!center || !center.length || !wrap.current) return;
    const xs = center.map((n) => xw.get(isBlackKey(n) ? n - 1 : n) ?? 0);
    const c = (Math.min(...xs) + Math.max(...xs)) / 2;
    wrap.current.scrollLeft = Math.max(0, c - wrap.current.clientWidth / 2 + W / 2);
  }, [center?.join(',')]);

  const down = (e: PointerEvent) => {
    const t = (e.target as Element).closest('[data-m]');
    if (!t || !onKey) return;
    e.preventDefault();
    onKey(Number((t as HTMLElement).dataset.m));
  };

  const blacks: number[] = [];
  for (let m = lo; m <= hi; m++) if (isBlackKey(m) && xw.has(m - 1)) blacks.push(m);

  return (
    <div class="kbwrap" ref={wrap}>
      <svg
        class={'kbsvg' + (onKey || fit ? ' fit' : '') + (onKey ? ' inter' : '')}
        viewBox={`0 0 ${width} ${H + 1}`}
        width={onKey || fit ? undefined : width}
        role="img"
        aria-label="Clavier de piano"
        onPointerDown={down}
      >
        {whites.map((m) => {
          const c = marks[m] ?? '';
          const x = xw.get(m)!;
          return (
            <g key={m}>
              <rect class={`kw ${c}`} data-m={m} x={x + 0.5} y={0.5} width={W - 1} height={H} rx={3} />
              {labels[m] ? (
                <text class={'kl' + (c && c !== 'miss' && c !== 'soft' ? ' on' : '')} x={x + W / 2} y={H - 8}>{labels[m]}</text>
              ) : m % 12 === 0 ? (
                <text class="kl oct" x={x + W / 2} y={H - 8}>{`C${m / 12 - 1}`}</text>
              ) : null}
            </g>
          );
        })}
        {blacks.map((m) => {
          const c = marks[m] ?? '';
          const x = xw.get(m - 1)! + W - BW / 2;
          return (
            <g key={m}>
              <rect class={`kb ${c}`} data-m={m} x={x} y={0.5} width={BW} height={BH} rx={2} />
              {labels[m] ? <text class={'kl dk' + (c && c !== 'miss' && c !== 'soft' ? ' on' : '')} x={x + BW / 2} y={BH - 7}>{labels[m]}</text> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
