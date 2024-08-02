import "./vendor/preact/debug.js"; // should be first

import { assert, bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useState, useEffect, useCallback } from "./vendor/preact/hooks.js";
import * as storage from "./storage.js";

function FileInput(props: { on_upload: (name: string, contents: string) => void }) {
    let { on_upload } = props;
    return <input type="file" id="fileInput" accept=".ant" onChange={(e) => {
        let target = bang(e.target as HTMLInputElement);
        let file = target.files?.[0];
        if (!file) return;
        console.log(file.name, file.type);

        const reader = new FileReader();
        reader.onload = function(e) {
            const contents = bang(e.target).result;
            assert(typeof contents === "string", typeof contents);
            on_upload(file.name, contents);
        };
        reader.readAsText(file);
    }}/>;
}

let all_worlds = [
    "sample0",
    "sample1",
    "sample2",
    "sample3",
    "sample4",
    "sample5",
    "sample6",
    "sample7",
    "sample8",
    "sample9",
    "tiny",
];

function App(props: { db: IDBDatabase, all_ants0: storage.Ant[] }) {
    let { db, all_ants0 } = props;
    // all_ants0 prop is ugly, but it's needed to avoid initial brief flash
    // of file input in the wrong place while the list is empty.

    let [all_ants, set_all_ants] = useState<storage.Ant[]>(all_ants0);
    const refresh_ants = useCallback(async () => {
        set_all_ants(await storage.get_all_ants(db));
    }, [db]);

    useEffect(() => {
        refresh_ants();
    }, [refresh_ants]);

    let [red_ant_id, set_red_ant_id] = useState("");
    let [black_ant_id, set_black_ant_id] = useState("");
    let [selected_world, set_selected_world] = useState("");
    let [is_hovering, set_is_hovering] = useState(false);

    let red_ant_selected = all_ants.some(ant => ant.id === red_ant_id);
    let black_ant_selected = all_ants.some(ant => ant.id === black_ant_id);

    let ants = <>
        <h3>Ants</h3>
        <table>
            <tbody>
                {all_ants.map(ant => (
                    <tr key={ant.id}>
                        <td>{ant.name}</td>
                        <td>
                            <button onClick={async () => {
                                await storage.delete_ant(db, ant.id);
                                refresh_ants();
                                // TODO: show toast with undo option
                            }}>Delete</button>
                        </td>
                        <td>
                            <div
                                className={`ant-selector red ${red_ant_id === ant.id ? 'selected' : ''} ${is_hovering && !red_ant_selected ? 'flash' : ''}`}
                                onClick={() => set_red_ant_id(ant.id)}
                            />
                        </td>
                        <td>
                            <div
                                className={`ant-selector black ${black_ant_id === ant.id ? 'selected' : ''} ${is_hovering && !black_ant_selected ? 'flash' : ''}`}
                                onClick={() => set_black_ant_id(ant.id)}
                            />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        <br/>
        Add ant:<br/>
        <FileInput on_upload={async (name, contents) => {
            if (name.endsWith(".ant")) {
                name = name.slice(0, -4);
            }
            let id = await storage.compute_ant_id(contents);
            let ant = { id, name, source: contents };
            let added = await storage.add_ant(db, ant);
            console.log("added", added);  // TODO: show toast (added or duplicate)
            if (added) {
                refresh_ants();
            }
        }}/>
    </>;

    let worlds = <>
        <h3>Worlds</h3>
        <table>
            <tbody>
                {all_worlds.map(world => (
                    <tr key={world}>
                        <td>
                            <div
                                className={`world-selector ${selected_world === world ? 'selected' : ''} ${is_hovering && !selected_world ? 'flash' : ''}`}
                                onClick={() => set_selected_world(world)}
                            />
                        </td>
                        <td>{world}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </>;

    let errors = [];
    if (!red_ant_selected) errors.push("Red and not selected");
    if (!black_ant_selected) errors.push("Black and not selected");
    if (!selected_world) errors.push("World not selected");

    let management = <>
        <h3>Run game</h3>
        <label>Seed</label><br/>
        <input type="text" value="42" style={{ width: "60px" }}/>
        <br/>
        <br/>
        <input
            type="button"
            value="Run"
            disabled={errors.length > 0}
            title={errors.join("\n")}
            onClick={() => {
                console.log("Run", red_ant_id, black_ant_id, selected_world);
            }}
            onMouseEnter={() => set_is_hovering(true)}
            onMouseLeave={() => set_is_hovering(false)}
        />
    </>;

    return (
        <div style={{ display: "flex", justifyContent: "flex-start", gap: "20px" }}>
            <div style={{ flexBasis: "auto" }}>
                {ants}
            </div>
            <div style={{ flexBasis: "auto" }}>
                {management}
            </div>
            <div style={{ flexBasis: "auto" }}>
                {worlds}
            </div>
        </div>
    );
}

async function main() {
    let db = await storage.init();
    let all_ants0 = await storage.get_all_ants(db);
    let root = bang(document.getElementById("root"));
    preact.render(<App db={db} all_ants0={all_ants0}/>, root);
}
main();
