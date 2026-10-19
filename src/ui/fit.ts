/** Taille de police (en % de la largeur du bloc, unité cqw) pour qu'un symbole d'accord tienne sur une ligne. */
export const fitSymbol = (sym: string, max: number, k: number) => Math.min(max, k / Math.max(3, [...sym].length)).toFixed(1);
