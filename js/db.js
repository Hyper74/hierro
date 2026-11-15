// ─────────────────────────────────────────────────────────────
// Capa mínima sobre IndexedDB (promesas). Todo vive en el iPhone.
// Almacenes:
//   exercises  – biblioteca (incluida la precargada y la propia)
//   routines   – rutinas
//   workouts   – entrenos terminados
//   kv         – clave/valor: ajustes, entreno en curso, versiones…
// ─────────────────────────────────────────────────────────────

const DB_NAME = 'hierro';
const DB_VERSION = 1;
let dbp = null;

export function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('exercises')) db.createObjectStore('exercises', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('routines')) db.createObjectStore('routines', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('workouts')) {
        const s = db.createObjectStore('workouts', { keyPath: 'id' });
        s.createIndex('start', 'start');
      }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // Si otra pestaña actualiza la BD, cerramos para no bloquearla.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function done(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('Transacción abortada'));
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function getAll(store) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).getAll());
}
export async function get(store, key) {
  const db = await open();
  return reqP(db.transaction(store).objectStore(store).get(key));
}
export async function put(store, obj) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(obj);
  return done(tx);
}
export async function putMany(store, arr) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const o of arr) os.put(o);
  return done(tx);
}
export async function del(store, key) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  return done(tx);
}
export async function delMany(store, keys) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const k of keys) os.delete(k);
  return done(tx);
}
export async function clear(store) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  return done(tx);
}
export async function kvGet(key) {
  const r = await get('kv', key);
  return r ? r.value : undefined;
}
export const kvSet = (key, value) => put('kv', { key, value });
export const kvDel = (key) => del('kv', key);

/** Reemplaza todo el contenido de varios almacenes en una sola transacción. */
export async function replaceAll(data) {
  const db = await open();
  const stores = Object.keys(data);
  const tx = db.transaction(stores, 'readwrite');
  for (const s of stores) {
    const os = tx.objectStore(s);
    os.clear();
    for (const o of data[s]) os.put(o);
  }
  return done(tx);
}
