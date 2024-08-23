import "./vendor/preact/debug.js"; // should be first

import { bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useState, useEffect } from "./vendor/preact/hooks.js";
import * as storage from "./storage.js";
import { Lobby } from "./lobby.js";

function useLocationHash() {
    let [hash, set_hash] = useState(window.location.hash);
    useEffect(() => {
        let on_hashchange = () => set_hash(window.location.hash);
        window.addEventListener("hashchange", on_hashchange);
        return () => window.removeEventListener("hashchange", on_hashchange);
    }, []);
    if (hash.startsWith("#")) {
        hash = hash.slice(1);
    }
    return hash;
}

function App(props: { db: IDBDatabase }) {
    let hash = useLocationHash();
    if (hash === "") {
        return <Lobby db={props.db}/>;
    } else {
        return <>Unknown hash: {hash}</>;
    }
}

async function main() {
    let db = await storage.init();
    let root = bang(document.getElementById("root"));
    preact.render(<App db={db} />, root);
}
main();
