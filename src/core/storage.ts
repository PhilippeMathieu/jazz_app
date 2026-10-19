// Préférences et statistiques, stockées sur l'appareil.
// Les valeurs lues sont fusionnées en profondeur avec les valeurs par défaut,
// et ne gardent que les champs du bon type : un ancien format ne peut pas casser l'appli.

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Fusionne `stored` dans `fallback` en respectant les types de `fallback`. */
export function merge<T>(fallback: T, stored: unknown): T {
  if (isPlain(fallback)) {
    if (!isPlain(stored)) return fallback;
    const out: Plain = { ...fallback };
    // Dictionnaire vide par défaut (ex. stats par clé) : on reprend toutes les entrées stockées.
    const open = Object.keys(fallback).length === 0;
    for (const k of Object.keys(open ? stored : fallback)) {
      if (k in stored) out[k] = open ? stored[k] : merge((fallback as Plain)[k], stored[k]);
    }
    return out as T;
  }
  if (Array.isArray(fallback)) return (Array.isArray(stored) ? stored : fallback) as T;
  return (typeof stored === typeof fallback ? stored : fallback) as T;
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('hj:' + key);
    return raw ? merge(fallback, JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem('hj:' + key, JSON.stringify(value));
  } catch {
    /* stockage plein ou bloqué : on continue sans */
  }
}
