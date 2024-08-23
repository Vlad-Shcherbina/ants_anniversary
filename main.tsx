import "./vendor/preact/debug.js"; // should be first

import { assert, bang, never } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useEffect, useState } from "./vendor/preact/hooks.js";
import * as storage from "./storage.js";
import { Lobby } from "./lobby.js";
import { hash_to_route, useLocationHash } from "./routing.js";

function App(props: { db: IDBDatabase }) {
    let hash = useLocationHash();
    let route = hash_to_route(hash);
    switch (route.type) {
        case "default": return <Lobby db={props.db}/>;
        case "ant": return <ViewAnt db={props.db} id={route.id}/>;
        case "world": return <ViewWorld name={route.name}/>;
        case "game": return <div>TODO: game {JSON.stringify(route)}</div>;
        default: never(route);
    }
}

function ViewAnt(props: { db: IDBDatabase, id: string }) {
    let { db, id } = props;
    let [ant, set_ant] = useState<storage.Ant | null | undefined>(null);
    // null -- loading, undefined -- not found
    useEffect(() => {
        storage.get_ant(db, id).then(set_ant)
    }, [db, id]);
    if (ant === null) return <></>;
    if (ant === undefined) return <div>Ant not found: {id}</div>;
    return <>
        <h3>{ant.name}</h3>
        <pre>{ant.source}</pre>    
    </>;
}

function ViewWorld(props: { name: string }) {
    let { name } = props;
    let [text, set_text] = useState<string | null>(null);
    useEffect(() => {
        (async () => {
            let resp = await fetch(`data/${name}.world`);
            assert(resp.ok); // TODO?
            set_text(await resp.text());
        })();
    }, [name]);
    if (text === null) return <></>;
    return <>
        <h3>{name}</h3>
        <pre>{text}</pre>
    </>;
}

async function main() {
    let db = await storage.init();
    let root = bang(document.getElementById("root"));
    preact.render(<App db={db} />, root);
}
main();
