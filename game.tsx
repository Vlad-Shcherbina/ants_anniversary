import { assert, bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useEffect, useState } from "./vendor/preact/hooks.js";
import * as storage from "./storage.js";
import { type World, parse_world } from "./cartography.js";
import { type Insn, parse_brain } from "./brain.js";
import { Sim } from "./sim.js";


type GameProps = {
    db: IDBDatabase,
    red_ant_id: string,
    black_ant_id: string,
    world_name: string,
    seed: number,
}

export function ViewGame(props: GameProps) {
    let { db, red_ant_id, black_ant_id, world_name, seed } = props;
    
    let [world, set_world] = useState<World | null>(null);
    useEffect(() => {
        (async () => {
            let resp = await fetch(`data/${world_name}.world`);
            assert(resp.ok);
            let text = await resp.text();
            set_world(parse_world(text));
        })();
    }, [world_name]);
    
    let [brains, set_brains] = useState<Insn[][] | null>(null);
    useEffect(() => {
        (async () => {
            let red_brain = parse_brain(bang(await storage.get_ant(db, red_ant_id)).source);
            let black_brain = parse_brain(bang(await storage.get_ant(db, black_ant_id)).source);
            set_brains([red_brain, black_brain]);
        })();
    }, [db, red_ant_id, black_ant_id]);
    
    useEffect(() => {
        if (world === null || brains === null) return;
        let sim = Sim.create({ world, red_brain: brains[0], black_brain: brains[1], seed });
        console.time("run simulation");
        for (let i = 0; i < 100000; i++) {
            sim.step();
        }
        console.timeEnd("run simulation");
        // for (let line of sim.dump_state()) {
        //     console.log(line);
        // }
    }, [brains, world, seed]);
    
    return <></>;
}