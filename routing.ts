import { assert } from "./assert.js";
import { useState, useEffect } from "./vendor/preact/hooks.js";

type Route = {
    type: "default",
} | {
    type: "ant",
    id: string,
} | {
    type: "world",
    name: string,
}

export function route_to_hash(r: Route): string {
    let { type, ...args } = r;
    if (type === "default") return "#";
    return "#" + encodeURIComponent(type + "." + JSON.stringify(args));
}

export function hash_to_route(hash: string): Route {
    assert(hash.startsWith("#"));
    hash = decodeURIComponent(hash.slice(1));
    if (hash === "") return { type: "default" };
    let [type, args] = hash.split(".", 2);
    console.log("args", args);
    return { type, ...JSON.parse(args) };
}

export function useLocationHash() {
    let [hash, set_hash] = useState(window.location.hash);
    useEffect(() => {
        let on_hashchange = () => set_hash(window.location.hash);
        window.addEventListener("hashchange", on_hashchange);
        return () => window.removeEventListener("hashchange", on_hashchange);
    }, []);
    if (hash === "") {
        hash = "#";
    }
    assert(hash.startsWith("#"));
    return hash;
}
