import { assert } from "./assert.js";
import type { Insn } from "./brain.js";
import type { WorldPos, World } from "./cartography.js";

/** Barycentric hex coordinates.

There is also an implicit `w = -u-v` component.

Layout, in the form of (u, v) pairs:
```
    (0, 0) (0, 1) (0, 2)
       (1, 0) (1, 1) (1, 2)
    (2,-1) (2, 0) (2, 1)
````
*/
type Pos = {
    u: number,
    v: number,
}

function world_pos_to_pos({ x, y }: WorldPos): Pos {
    let u = y;
    let v = x - Math.floor(y / 2);
    return { u, v };
}

function check_world_pos_to_pos(x: number, y: number, u: number, v: number) {
    let p = world_pos_to_pos({ x, y });
    assert(p.u === u);
    assert(p.v === v);
}
check_world_pos_to_pos(0, 0,  0, 0);
check_world_pos_to_pos(1, 0,  0, 1);
check_world_pos_to_pos(0, 1,  1, 0);
check_world_pos_to_pos(0, 2,  2, -1);

type Cell = {
    is_rock: boolean,
    ant: number | null,
    hill: "red" | "black" | null,
    food: number,
    red_markers: number,
    black_markers: number,
}

type Ant = {
    color: "red" | "black",
    state: number,
    resting: number,
    dir: number,
    has_food: boolean,
}

// A trick to avoid constructor boilerplate.
// Spread operator extracts all fields, but omits methods.
// It can't be used directly in the `typeof` context, so we introduce a constant,
// even though we only care about its inferred type.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALL_SIM_FIELDS = { ... {} as Sim };

export class Sim {
    min_u!: number;
    min_v!: number;
    width!: number;
    height!: number;
    cells!: Cell[];
    wp_to_idx!: (WorldPos & { idx: number })[];
    ants!: Ant[];
    red_brain!: Insn[];
    black_brain!: Insn[];
    
    constructor(args: typeof ALL_SIM_FIELDS) {
        Object.assign(this, args);
    }
    
    static create(args: { world: World, red_brain: Insn[], black_brain: Insn[] }): Sim {
        let { world, red_brain, black_brain } = args;
        let ants: Ant[] = [];
        function add_ant(color: "red" | "black") {
            ants.push({
                color,
                state: 0,
                resting: 0,
                dir: 0,
                has_food: false,
            });
            return ants.length - 1;
        }

        let poss = world.map(world_pos_to_pos);
        let min_u = Math.min(...poss.map(p => p.u));
        let max_u = Math.max(...poss.map(p => p.u));
        let min_v = Math.min(...poss.map(p => p.v));
        let max_v = Math.max(...poss.map(p => p.v));
        console.log(min_u, max_u);
        console.log(min_v, max_v);
        let width = max_v - min_v + 1;
        let height = max_u - min_u + 1;
        let cells: Cell[] = Array.from({ length: width * height }, () => ({
            is_rock: false,
            ant: null,
            hill: null,
            food: 0,
            red_markers: 0,
            black_markers: 0,
        }));
        let wp_to_idx: (WorldPos & { idx: number })[] = [];
        for (let wp of world) {
            let pos = world_pos_to_pos(wp);
            let idx = (pos.u - min_u) * width + (pos.v - min_v);
            wp_to_idx.push({ ...wp, idx });
            let cell = cells[idx];
            switch (wp.cell) {
                case "Rock": cell.is_rock = true; break;
                case "Clear": break;
                case "RedAnthill":
                    cell.hill = "red";
                    cell.ant = add_ant("red");
                    break;
                case "BlackAnthill":
                    cell.hill = "black";
                    cell.ant = add_ant("black");
                    break;
                default: {
                    let _: "Food" = wp.cell.type;
                    cell.food = wp.cell.count;
                }
            }
        }
        /*for (let u = 0; u < height; u++) {
            let s = " ".repeat(u);
            for (let v = 0; v < width; v++) {
                if (cells[u * width + v].is_rock) {
                    s += "#";
                } else {
                    s += ".";
                }
                s += " ";
            }
            console.log(s);
        }*/
        return new Sim({
            min_u, min_v, width, height, wp_to_idx,
            cells,
            ants,
            red_brain,
            black_brain,
        });
    }
    
    dump_state(): string[] {
        return this.wp_to_idx.map(({ x, y, idx }) => {
            let cell = this.cells[idx];
            let res = `cell (${x}, ${y}): `;
            if (cell.is_rock) {
                res += "rock";
            }
            if (cell.food > 0) {
                res += `${cell.food} food; `;
            }
            if (cell.hill) {
                res += `${cell.hill} hill; `;
            }
            if (cell.ant !== null) {
                const ant = this.ants[cell.ant];
                res += `${ant.color} ant of id ${cell.ant}, dir ${ant.dir}, food ${ant.has_food ? 1 : 0}, state ${ant.state}, resting ${ant.resting}`;
            }
            assert(cell.red_markers === 0, "TODO");
            assert(cell.black_markers === 0, "TODO");
            return res;
        })
    }
}
