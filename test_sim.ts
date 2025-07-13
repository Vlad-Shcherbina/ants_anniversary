import { assert, bang } from "./assert.js";
import { parse_brain } from "./brain.js";
import { parse_world } from "./cartography.js";
import { Sim } from "./sim.js";

async function main() {
    let brain;
    {
        let resp = await fetch("data/sample.ant");
        assert(resp.ok);
        let text = await resp.text();
        brain = parse_brain(text);
    }
    let world;
    {
        let resp = await fetch("data/tiny.world");
        assert(resp.ok);
        let text = await resp.text();
        world = parse_world(text);
        console.log(world);
    }
    let seed = 12345;
    let sim = Sim.create({ world, red_brain: brain, black_brain: brain, seed });
    console.log(sim.dump_state());
    
    let expected_lines: string[] = [];
    {
        console.time("fetch and unpack trace");
        // http://www.cis.upenn.edu/~plclub/contest/dump/dump.all.gz
        let resp = await fetch("data/dump.all.gz");
        assert(resp.ok);
        const full_text = await resp.text();
        // console.log(full_text.length, full_text.slice(0, 4000));
        console.timeEnd("fetch and unpack trace");
        expected_lines = full_text.trimEnd().split("\n");
    }
    
    console.time("trace 10000 rounds");
    let lines = [];
    lines.push(`random seed: ${seed}`);
    for (let round = 0; round <= 10000; round++) {
        lines.push("");
        lines.push(`After round ${round}...`);
        lines.push(...sim.dump_state());
        sim.step();
    }
    console.timeEnd("trace 10000 rounds");

    lines.forEach((line, i) => {
        // console.log(line);
        if (line !== expected_lines[i]) {
            console.log(`line ${i}:`);
            console.log(`  expected: ${expected_lines[i]}`);
            console.log(`  actual:   ${line}`);
            assert(false);
        }
    })
    console.log(lines.length, "lines match");
    assert(lines.length === expected_lines.length);
}

main();
