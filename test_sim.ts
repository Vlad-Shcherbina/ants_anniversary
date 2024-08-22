import { assert, bang } from "./assert.js";

async function main() {
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
    console.log(full_text.length, full_text.slice(0, 4000));    
    console.timeEnd("fetch and unpack trace");
}

main();
