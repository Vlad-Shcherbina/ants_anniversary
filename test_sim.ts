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
        let ds = new DecompressionStream('gzip');
        let stream: ReadableStream<Uint8Array> = bang(resp.body).pipeThrough(ds);
        let reader = stream.getReader();
        let decoder = new TextDecoder();
        let full_text = "";
        while (true) {
            let { done, value: chunk } = await reader.read();
            if (done) { break; }
            assert(!!chunk);
            full_text += decoder.decode(chunk, { stream: true });
        }
        full_text += decoder.decode(); // flush the decoder
        // console.log(full_text.length, full_text.slice(0, 4000));
        console.timeEnd("fetch and unpack trace");
        expected_lines = full_text.trimEnd().split("\n");
    }
    
    let lines = [];
    lines.push(`random seed: ${seed}`);
    for (let round = 0; round < 6; round++) {
        lines.push("");
        lines.push(`After round ${round}...`);
        lines.push(...sim.dump_state());
        sim.step();
    }

    lines.forEach((line, i) => {
        console.log(line);
        if (line !== expected_lines[i]) {
            console.log(`line ${i}:`);
            console.log(`  expected: ${expected_lines[i]}`);
            console.log(`  actual:   ${line}`);
            assert(false);
        }
    })
    console.log(lines.length, "lines match");
}

main();
