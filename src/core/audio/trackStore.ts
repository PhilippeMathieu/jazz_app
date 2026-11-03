// Les bandes-son de l'élève (ses propres fichiers), gardées sur l'appareil dans IndexedDB : jamais envoyées ailleurs.
const DB = 'hj-bandes';
const STORE = 'pistes';

function open(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((ok, ko) => {
        const tx = db.transaction(STORE, mode);
        const req = f(tx.objectStore(STORE));
        tx.oncomplete = () => (ok(req.result), db.close());
        tx.onerror = () => (ko(tx.error), db.close());
      })
  );
}

export const saveTrack = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id)).then(() => undefined);
export const getTrack = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteTrack = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined);
export const listTracks = () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String));

/** Demande au navigateur de ne pas effacer ces fichiers quand l'espace manque. */
export function keepStorage() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* rien */
  }
}
