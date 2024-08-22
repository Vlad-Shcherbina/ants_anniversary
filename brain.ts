type SenseDir = "Here" | "Ahead" | "LeftAhead" | "RightAhead";

type Marker = 0 | 1 | 2 | 3 | 4 | 5;

type LeftOrRight = "Left" | "Right";

type Cond =
    | "Friend"
    | "Foe"
    | "FriendWithFood"
    | "FoeWithFood"
    | "Food"
    | "Rock"
    | { type: "Marker", marker: Marker }
    | "FoeMarker"
    | "Home"
    | "FoeHome";

type Insn =
    | { type: "Sense", dir: SenseDir, st1: number, st2: number, cond: Cond }
    | { type: "Mark", marker: Marker, st: number }
    | { type: "Unmark", marker: Marker, st: number }
    | { type: "PickUp", st1: number, st2: number }
    | { type: "Drop", st: number }
    | { type: "Turn", dir: LeftOrRight, st: number }
    | { type: "Move", st1: number, st2: number }
    | { type: "Flip", p: number, st1: number, st2: number };

    
function parse_state(tokens: string[]): number {
    let token = tokens.shift();
    if (token === undefined) throw "missing state number";
    let state = parseFloat(token);
    // TODO: this doesn't check that parseFloat() consumed the whole token
    if (isNaN(state)) throw "invalid state number";
    if (state !== Math.floor(state)) throw "state number must be an integer";
    return state;
}

function parse_sense_dir(tokens: string[]): SenseDir {
    switch (tokens.shift()) {
        case undefined: throw "missing sense direction";
        case "here": return "Here";
        case "ahead": return "Ahead";
        case "leftahead": return "LeftAhead";
        case "rightahead": return "RightAhead";
        default: throw "unrecognized sense direction";
    }
}

function parse_marker(tokens: string[]): Marker {
    switch (tokens.shift()) {
        case undefined: throw "missing marker number";
        case "0": return 0;
        case "1": return 1;
        case "2": return 2;
        case "3": return 3;
        case "4": return 4;
        case "5": return 5;
        default: throw "invalid marker number";
    }
}

function parse_cond(tokens: string[]): Cond {
    switch (tokens.shift()) {
        case undefined: throw "missing condition";
        case "friend": return "Friend";
        case "foe": return "Foe";
        case "friendwithfood": return "FriendWithFood";
        case "foewithfood": return "FoeWithFood";
        case "food": return "Food";
        case "rock": return "Rock";
        case "home": return "Home";
        case "foehome": return "FoeHome";
        case "foemarker": return "FoeMarker";
        case "marker": {
            let marker = parse_marker(tokens);
            return { type: "Marker", marker };
        }
        default: throw "unrecognized condition";
    }
}

function check_end(tokens: string[]) {
    if (tokens.shift() !== undefined) {
        throw "extra tokens at end of line";
    }
}

export function parse_insn(line: string): Insn {
    line = line.split(";")[0].trim();

    let tokens = line.toLowerCase().split(/\s+/);
    let insn_type = tokens.shift();
    switch (insn_type) {
        case undefined: throw "empty line";
        case "sense": {
            let dir = parse_sense_dir(tokens);
            let st1 = parse_state(tokens);
            let st2 = parse_state(tokens);
            let cond = parse_cond(tokens);
            check_end(tokens);
            return { type: "Sense", dir, st1, st2, cond };
        }
        case "mark": {
            let marker = parse_marker(tokens);
            let st = parse_state(tokens);
            check_end(tokens);
            return { type: "Mark", marker, st };
        }
        case "unmark": {
            let marker = parse_marker(tokens);
            let st = parse_state(tokens);
            check_end(tokens);
            return { type: "Unmark", marker, st };
        }
        case "pickup": {
            let st1 = parse_state(tokens);
            let st2 = parse_state(tokens);
            check_end(tokens);
            return { type: "PickUp", st1, st2 };
        }
        case "drop": {
            let st = parse_state(tokens);
            check_end(tokens);
            return { type: "Drop", st };
        }
        case "turn": {
            let dir: LeftOrRight;
            switch (tokens.shift()) {
                case undefined: throw "missing turn direction";
                case "left": dir = "Left"; break;
                case "right": dir = "Right"; break;
                default: throw "unrecognized turn direction";
            }
            let st = parse_state(tokens);
            check_end(tokens);
            return { type: "Turn", dir, st };
        }
        case "move": {
            let st1 = parse_state(tokens);
            let st2 = parse_state(tokens);
            check_end(tokens);
            return { type: "Move", st1, st2 };
        }
        case "flip": {
            let p_str = tokens.shift();
            if (p_str === undefined) throw "missing p";
            let p = parseFloat(p_str);
            // TODO: this doesn't check that parseFloat() consumed the whole token
            if (isNaN(p)) throw "invalid p";
            if (p !== Math.floor(p)) throw "p must be an integer";
            if (p <= 0) throw "p must be positive";
            let st1 = parse_state(tokens);
            let st2 = parse_state(tokens);
            check_end(tokens);
            return { type: "Flip", p, st1, st2 };
        }
        default: throw "unrecognized instruction";
    }
}

export function parse_brain(s: string): Insn[] {
    return s.trimEnd().split("\n").map((line, i) => {
        try {
            return parse_insn(line);
        } catch (e) {
            throw `line ${i + 1}: ${JSON.stringify(line)}\n${e}`;
        }
    });
}
