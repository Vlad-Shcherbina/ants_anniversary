import "./vendor/preact/debug.js"; // should be first

import { bang, never } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import * as storage from "./storage.js";
import { Lobby } from "./lobby.js";
import { hash_to_route, useLocationHash } from "./routing.js";

function App(props: { db: IDBDatabase }) {
    let hash = useLocationHash();
    let route = hash_to_route(hash);
    switch (route.type) {
        case "default": return <Lobby db={props.db}/>;
        case "ant": return <>Ant: {route.id}</>;
        case "world": return <>World: {route.name}</>;
        default: never(route);
    }
}

async function main() {
    let db = await storage.init();
    let root = bang(document.getElementById("root"));
    preact.render(<App db={db} />, root);
}
main();
