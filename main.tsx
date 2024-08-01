import "./vendor/preact/debug.js"; // should be first

import { bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";

function App() {
    return <div>Hello, world!</div>;
}

let root = bang(document.getElementById("root"));
preact.render(<App/>, root);
