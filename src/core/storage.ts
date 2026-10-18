// Petites préférences et statistiques, stockées sur l'appareil.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('hj:' + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem('hj:' + key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : on continue sans */
  }
}
