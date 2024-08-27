import { assert, bang, never } from "./assert.js";
import type { Insn, Cond } from "./brain.js";
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

export enum Color {
    Red,
    Black,
}

type Cell = {
    is_rock: boolean,
    ant: number | null,
    hill: Color | null,
    food: number,
    markers: number[],
}

type Ant = {
    color: Color,
    cell_idx: number;
    state: number,
    resting: number,
    dir: number,
    has_food: boolean,
}

function clone_cell(cell: Cell): Cell {
    return { ...cell, markers: [...cell.markers] };
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
    ants!: (Ant | null)[]; // null means dead
    brains!: Insn[][];
    rng!: Rng;
    dir_offsets!: number[];
    hill_food!: number[];
    unclaimed_food!: number;
    food_carried_by_ants!: number[];
    ant_counts!: number[];

    constructor(args: typeof ALL_SIM_FIELDS) {
        Object.assign(this, args);
    }

    clone(): Sim {
        // mutable parts are deeply copied,
        // constant parts are shallow copied
        return new Sim({
            min_u: this.min_u,
            min_v: this.min_v,
            width: this.width,
            height: this.height,
            cells: this.cells.map(clone_cell),
            wp_to_idx: this.wp_to_idx,
            ants: this.ants.map(ant => ant === null ? null : { ...ant }),
            brains: this.brains,
            rng: this.rng.clone(),
            dir_offsets: this.dir_offsets,
            hill_food: [...this.hill_food],
            unclaimed_food: this.unclaimed_food,
            food_carried_by_ants: [...this.food_carried_by_ants],
            ant_counts: [...this.ant_counts],
        });
    }

    static create(args: { world: World, red_brain: Insn[], black_brain: Insn[], seed: number }): Sim {
        let { world, red_brain, black_brain, seed } = args;
        let ants: Ant[] = [];
        function add_ant(color: Color, cell_idx: number) {
            ants.push({
                color,
                cell_idx,
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
            markers: [0, 0],
        }));
        let wp_to_idx: (WorldPos & { idx: number })[] = [];
        let unclaimed_food = 0;
        let ant_counts = [0, 0];
        for (let wp of world) {
            let pos = world_pos_to_pos(wp);
            let idx = (pos.u - min_u) * width + (pos.v - min_v);
            wp_to_idx.push({ ...wp, idx });
            let cell = cells[idx];
            switch (wp.cell) {
                case "Rock": cell.is_rock = true; break;
                case "Clear": break;
                case "RedAnthill":
                    cell.hill = Color.Red;
                    cell.ant = add_ant(Color.Red, idx);
                    ant_counts[Color.Red] += 1;
                    break;
                case "BlackAnthill":
                    cell.hill = Color.Black;
                    cell.ant = add_ant(Color.Black, idx);
                    ant_counts[Color.Black] += 1;
                    break;
                default: {
                    let _: "Food" = wp.cell.type;
                    cell.food = wp.cell.count;
                    unclaimed_food += wp.cell.count;
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

        let dir = { u: 0, v: 1 };
        let dir_offsets: number[] = [];
        for (let i = 0; i < 6; i++) {
            console.log(dir);
            dir_offsets.push(dir.u * width + dir.v);
            let { u, v } = dir;
            let w = -u - v;
            dir = { u: -w, v: -u }
        }
        assert(dir.u === 0 && dir.v === 1);
        let brains: Insn[][] = [[], []];
        brains[Color.Red] = red_brain;
        brains[Color.Black] = black_brain;
        return new Sim({
            min_u, min_v, width, height, wp_to_idx,
            cells,
            ants,
            brains,
            dir_offsets,
            hill_food: [0, 0],
            rng: new Rng(seed),
            unclaimed_food,
            food_carried_by_ants: [0, 0],
            ant_counts,
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
            if (cell.hill !== null) {
                res += `${Color[cell.hill].toLowerCase()} hill; `;
            }
            for (let color of [Color.Red, Color.Black]) {
                let marker = cell.markers[color];
                if (marker > 0) {
                    res += `${Color[color].toLowerCase()} marks: `;
                    for (let i = 0; i < 6; i++) {
                        if (marker & (1 << i)) {
                            res += i;
                        }
                    }
                    res += "; ";
                }
            }
            if (cell.ant !== null) {
                let ant = bang(this.ants[cell.ant]);
                let color = Color[ant.color].toLowerCase();
                res += `${color} ant of id ${cell.ant}, dir ${ant.dir}, food ${ant.has_food ? 1 : 0}, state ${ant.state}, resting ${ant.resting}`;
            }
            return res;
        })
    }

    step() {
        for (let ant_id = 0; ant_id < this.ants.length; ant_id++) {
            let ant = this.ants[ant_id];
            if (ant === null) continue;
            if (ant.resting > 0) {
                ant.resting--;
                continue;
            }
            let brain = this.brains[ant.color];
            let insn = brain[ant.state];
            let cell = this.cells[ant.cell_idx];
            switch (insn.type) {
                case "Flip": {
                    let random_result = this.rng.random_int(insn.p);
                    ant.state = random_result === 0 ? insn.st1 : insn.st2;
                    break;
                }
                case "Turn": {
                    ant.dir = (ant.dir + (insn.dir === "Left" ? 5 : 1)) % 6;
                    ant.state = insn.st;
                    break;
                }
                case "Move": {
                    let new_cell_idx = ant.cell_idx + this.dir_offsets[ant.dir];
                    if (this.cells[new_cell_idx].is_rock || this.cells[new_cell_idx].ant !== null) {
                        ant.state = insn.st2;
                    } else {
                        cell.ant = null;
                        this.cells[new_cell_idx].ant = ant_id;
                        ant.cell_idx = new_cell_idx;
                        ant.state = insn.st1;
                        ant.resting = 14;

                        this.check_for_surrounded_ant(ant.cell_idx);
                        for (let offset of this.dir_offsets) {
                            this.check_for_surrounded_ant(ant.cell_idx + offset);
                        }
                    }
                    break;
                }
                case "Drop": {
                    if (ant.has_food) {
                        cell.food++;
                        if (cell.hill !== null) {
                            this.hill_food[cell.hill]++;
                            this.food_carried_by_ants[ant.color]--;
                        }
                        ant.has_food = false;
                    }
                    ant.state = insn.st;
                    break;
                }
                case "PickUp": {
                    if (ant.has_food || cell.food === 0) {
                        ant.state = insn.st2;
                    } else {
                        cell.food--;
                        if (cell.hill !== null) {
                            this.hill_food[cell.hill]--;
                        } else {
                            this.unclaimed_food--;
                        }
                        this.food_carried_by_ants[ant.color]++;
                        ant.has_food = true;
                        ant.state = insn.st1;
                    }
                    break;
                }
                case "Unmark": {
                    cell.markers[ant.color] &= ~(1 << insn.marker);
                    ant.state = insn.st;
                    break;
                }
                case "Mark": {
                    cell.markers[ant.color] |= 1 << insn.marker;
                    ant.state = insn.st;
                    break;
                }
                case "Sense": {
                    let sensed_cell_idx;
                    switch (insn.dir) {
                        case "Here": sensed_cell_idx = ant.cell_idx; break;
                        case "Ahead": sensed_cell_idx = ant.cell_idx + this.dir_offsets[ant.dir]; break;
                        case "LeftAhead": sensed_cell_idx = ant.cell_idx + this.dir_offsets[(ant.dir + 5) % 6]; break;
                        case "RightAhead": sensed_cell_idx = ant.cell_idx + this.dir_offsets[(ant.dir + 1) % 6]; break;
                        default: never(insn);
                    }
                    let condition_met = this.check_condition(this.cells[sensed_cell_idx], insn.cond, ant.color);
                    ant.state = condition_met ? insn.st1 : insn.st2;
                    break;
                }
                default: never(insn);
            }
        }
    }

    check_condition(cell: Cell, cond: Cond, ant_color: Color) {
        let ant: Ant | null;
        switch (cond) {
            case "Rock": return cell.is_rock;
            case "Friend": return cell.ant !== null && (ant = this.ants[cell.ant]) &&
                ant.color === ant_color;
            case "Foe": return cell.ant !== null && (ant = this.ants[cell.ant]) &&
                ant.color !== ant_color;
            case "FriendWithFood": return cell.ant !== null && (ant = this.ants[cell.ant]) &&
                ant.color === ant_color && ant.has_food;
            case "FoeWithFood": return cell.ant !== null && (ant = this.ants[cell.ant]) &&
                ant.color !== ant_color && ant.has_food;
            case "Home": return cell.hill === ant_color;
            case "FoeHome": return cell.hill !== null && cell.hill !== ant_color;
            case "Food": return cell.food > 0;
            case "FoeMarker": return cell.markers.some((m, c) => c !== ant_color && m !== 0);
            default: {
                let _: "Marker" = cond.type;
                return (cell.markers[ant_color] & (1 << cond.marker)) !== 0;
            }
        }
    }

    check_for_surrounded_ant(cell_idx: number): void {
        let cell = this.cells[cell_idx];
        if (cell.ant === null) return;

        let ant = bang(this.ants[cell.ant]);
        let enemy_count = 0;

        for (let offset of this.dir_offsets) {
            let adjacent_cell = this.cells[cell_idx + offset];
            if (adjacent_cell.ant !== null && bang(this.ants[adjacent_cell.ant]).color != ant.color) {
                enemy_count++;
            }
        }
        if (enemy_count >= 5) {
            this.ants[cell.ant] = null;
            cell.ant = null;
            if (ant.has_food) {
                this.food_carried_by_ants[ant.color]--;
            }
            let delta = 3 + (ant.has_food ? 1 : 0);
            cell.food += delta;
            if (cell.hill !== null) {
                this.hill_food[cell.hill] += delta;
            } else {
                this.unclaimed_food += delta;
            }
        }
    }
}

export class Rng {
    state: bigint;

    constructor(seed: number) {
        this.state = BigInt(seed);
        for (let i = 0; i < 3; i++) {
            this.state = (this.state * 22695477n + 1n) & 0x3fffffffn;
            console.log(this.state);
        }
    }

    clone(): Rng {
        let res = new Rng(0);
        res.state = this.state;
        return res;
    }

    random_int(n: number): number {
        this.state = (this.state * 22695477n + 1n) & 0x3fffffffn;
        return (Number(this.state) >>> 16) % n;
    }
}

function test_rng(): void {
    let rng = new Rng(12345);
    let expected = [
        7193, 2932, 10386, 5575, 100, 15976, 430, 9740, 9449, 1636,
        11030, 9848, 13965, 16051, 14483, 6708, 5184, 15931, 7014, 461,
        11371, 5856, 2136, 9139, 1684, 15900, 10236, 13297, 1364, 6876,
        15687, 14127, 11387, 13469, 11860, 15589, 14209, 16327, 7024, 3297,
        3120, 842, 12397, 9212, 5520, 4983, 7205, 7193, 4883, 7712,
        6732, 7006, 10241, 1012, 15227, 9910, 14119, 15124, 6010, 13191,
        5820, 14074, 5582, 5297, 10387, 4492, 14468, 7879, 8839, 12668,
        5436, 8081, 4900, 10723, 10360, 1218, 11923, 3870, 12071, 3574,
        12232, 15592, 12909, 9711, 6638, 2488, 12725, 16145, 9746, 9053,
        5881, 3867, 10512, 4312, 8529, 1576, 15803, 5498, 12730, 7397,
    ];

    for (let i = 0; i < 100; i++) {
        let actual = rng.random_int(16384);
        if (actual !== expected[i]) {
            throw new Error(`Mismatch at index ${i}: expected ${expected[i]}, actual ${actual}`);
        }
    }
}
test_rng();
