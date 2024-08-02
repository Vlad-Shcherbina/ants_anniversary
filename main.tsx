import "./vendor/preact/debug.js"; // should be first

import { assert, bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import * as storage from "./storage.js";

function App(props: { db: IDBDatabase }) {
    let { db } = props;
    return <div>
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
