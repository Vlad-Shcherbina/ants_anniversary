import { assert } from "./assert.js";

export type Ant = {
    id: string,
    name: string,
    source: string,
}

export async function init() {
    let req = window.indexedDB.open("ants_anniversary", 1);
    req.onupgradeneeded = (e) => {
        console.log(`upgrade: ${e.oldVersion} -> ${e.newVersion}`);
        assert(e.oldVersion === 0);
        let db = req.result;
        db.createObjectStore("ants", { keyPath: "id" });
    };
    let db = await idb_async(req);
    db.onversionchange = () => {
        assert(false, "live version change");
    };
    return db;
}

export async function add_ant(db: IDBDatabase, ant: Ant) {
    let tx = db.transaction("ants", "readwrite");
    try {
        let store = tx.objectStore("ants");
        let existing = await idb_async(store.get(ant.id));
        if (existing !== undefined) {
            return false;
        }
        await idb_async(store.add(ant));
        return true;
    } catch (e) {
        tx.abort();
        throw e;
    }
}

export async function get_all_ants(db: IDBDatabase): Promise<Ant[]> {
    let tx = db.transaction("ants", "readonly");
    return await idb_async(tx.objectStore("ants").getAll());
}

export async function compute_ant_id(source: string) {
    let msgBuffer = new TextEncoder().encode(source);
    let hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    let hashArray = Array.from(new Uint8Array(hashBuffer));
    let hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

function idb_async<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
