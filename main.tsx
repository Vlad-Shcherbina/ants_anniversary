import "./vendor/preact/debug.js"; // should be first

import { assert, bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useState, useEffect } from "./vendor/preact/hooks.js";
import * as storage from "./storage.js";

function App(props: { db: IDBDatabase }) {
    let { db } = props;

    let [all_ants, set_all_ants] = useState<storage.Ant[]>([]);
    async function refresh_ants() {
        set_all_ants(await storage.get_all_ants(db));
    }
    useEffect(() => {
        refresh_ants();
    }, []);

    return <div>
        <ul>
            {all_ants.map(ant => (
                <li key={ant.id}>
                    {ant.name}
                    <button onClick={async () => {
                        await storage.delete_ant(db, ant.id);
                        refresh_ants();
                        // TODO: show toast with undo option
                    }}>Delete</button>
                </li>
            ))}
        </ul>
        <input type="file" id="fileInput" accept=".ant" onChange={(e) => {
            let target = bang(e.target as HTMLInputElement);
            let file = target.files?.[0];
            if (!file) return;
            console.log(file.name, file.type);

            const reader = new FileReader();
            reader.onload = async function(e) {
                const contents = bang(e.target).result;
                assert(typeof contents === "string", typeof contents);
                let name = file.name;
                if (file.name.endsWith(".ant")) {
                    name = name.slice(0, -4);
                }
                let id = await storage.compute_ant_id(contents);
                let ant = { id, name, source: contents };
                let added = await storage.add_ant(db, ant);
                console.log("added", added);  // TODO: show toast (added or duplicate)
                if (added) {
                    refresh_ants();
                }
            };
            reader.readAsText(file);
        }}/>
    </div>;
}

async function main() {
    let db = await storage.init();
    let root = bang(document.getElementById("root"));
    preact.render(<App db={db}/>, root);
}
main();
