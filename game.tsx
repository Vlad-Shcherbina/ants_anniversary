import { assert, bang, never } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useCallback, useEffect, useState } from "./vendor/preact/hooks.js";
import * as storage from "./storage.js";
import { type World, parse_world } from "./cartography.js";
import { type Insn, parse_brain } from "./brain.js";
import { Sim, Color } from "./sim.js";
import { type Zone } from "./rez.js";
import { RezCanvas } from "./rez_preact.js";
import { update_tooltip } from "./tooltip.js";

type GameProps = {
    db: IDBDatabase,
    red_ant_id: string,
    black_ant_id: string,
    world_name: string,
    seed: number,
}

const NUM_STEPS = 100000;

type FoodChartEntry = {
    red_hill_food: number,
    red_ant_food: number,
    unclaimed_food: number,
    black_ant_food: number,
    black_hill_food: number,
}

// A wrapper object helps with "immutable" updates.
// The list of entries is long, and we want to push stuff to it.
// But React relies on object identity to detect changes.
// So we'll mutate the list in place, but each time we do so,
// we'll make a shallow copy of the wrapper object.
type FoodChart = {
    entries: FoodChartEntry[],
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

    let [food_chart, set_food_chart] = useState<FoodChart>({ entries: [] });
    let [key_frames, set_key_frames] = useState<{ step: number, sim: Sim }[]>([]);

    let [current_state, set_current_state] = useState<{ step: number, sim: Sim } | null>(null);
    let set_current_step = useCallback((new_step: number) => {
        set_current_state(current_state => {
            assert(current_state !== null);
            let key = null;
            for (let kf of key_frames) {
                if (kf.step > new_step) break;
                key = kf;
            }
            assert(key !== null);
            if (current_state.step <= new_step && current_state.step > key.step) {
                key = {
                    step: current_state.step,
                    sim: current_state.sim,
                };
            }
            assert(new_step >= key.step);
            let sim = key.sim.clone();
            assert(new_step >= key.step);
            for (let i = 0; i < new_step - key.step; i++) {
                sim.step();
            }
            return {
                step: new_step,
                sim,
            };
        });
    }, [key_frames]);

    useEffect(() => {
        if (world === null || brains === null) return;
        let sim = Sim.create({ world, red_brain: brains[0], black_brain: brains[1], seed });
        set_current_state({ step: 0, sim: sim.clone() });
        let step_count = 0;
        let timer_id: number | null = null;
        function run_batch() {
            const BATCH_SIZE = 10000;
            console.time("run batch");
            let new_food_chart_entries: FoodChartEntry[] = [];
            let new_key_frames: { step: number, sim: Sim }[] = [];
            for (let i = 0; i < BATCH_SIZE && step_count < NUM_STEPS; i++) {
                if (i % 1000 === 0) {
                    new_key_frames.push({ step: step_count, sim: sim.clone() });
                }
                sim.step();
                new_food_chart_entries.push({
                    red_hill_food: sim.hill_food[Color.Red],
                    red_ant_food: sim.food_carried_by_ants[Color.Red],
                    unclaimed_food: sim.unclaimed_food,
                    black_ant_food: sim.food_carried_by_ants[Color.Black],
                    black_hill_food: sim.hill_food[Color.Black],
                });
                step_count++;
            }
            console.timeEnd("run batch");
            set_food_chart(food_chart => {
                food_chart.entries.push(...new_food_chart_entries);
                return { ...food_chart };
            })
            set_key_frames(key_frames => [...key_frames, ...new_key_frames]);
            if (step_count < NUM_STEPS) {
                timer_id = setTimeout(run_batch, 0);
            } else {
                timer_id = null;
            }
        }
        timer_id = setTimeout(run_batch, 0);
        return () => {
            if (timer_id !== null) {
                clearTimeout(timer_id);
            }
        };
    }, [brains, world, seed]);

    useEffect(() => {
        if (current_state === null) return;
        let { step } = current_state;
        let on_key_down = (e: KeyboardEvent) => {
            let delta = 0;
            if (e.key === "ArrowRight") {
                e.preventDefault();
                delta = 1;
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                delta = -1;
            }
            if (e.shiftKey) {
                delta *= 14;
            }
            set_current_step(Math.max(0, Math.min(step + delta, food_chart.entries.length)))
        };
        document.addEventListener("keydown", on_key_down);
        return () => {
            document.removeEventListener("keydown", on_key_down);
        };
    }, [current_state, food_chart.entries.length, set_current_step]);

    if (current_state === null) {
        return <></>;
    }
    return <div style={{ display: "flex", flexDirection: "column", height: "90vh" }}>
        <Timeline food_chart={food_chart} current_step={current_state.step} set_current_step={set_current_step} />
        Current step: {current_state.step}
        <Board state={current_state} />
    </div>;
}

function Board(props: { state: { step: number, sim: Sim } }) {
    let { state } = props;
    let { sim } = state;
    type HoverDetail = { key: string, drag_x: number, drag_y: number };

    type RezState = {
        offset_x: number,
        offset_y: number,
        scale: number,
        dragging: null | { start_x: number, start_y: number },
    };
    let [rez_state, set_rez_state] = useState<RezState>({
        offset_x: 0,
        offset_y: 0,
        scale: 10,
        dragging: null,
    });

    let ui_fn = (canvas: HTMLCanvasElement) => {
        let zones: Zone<HoverDetail>[] = [];
        let ctx = bang(canvas.getContext("2d"));
        let { width, height } = canvas;
        zones.push({
            priority: -Infinity,
            paint: ({ hover_detail }) => {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, width, height);
                ctx.fillStyle = "yellow";
                ctx.fillRect(0, 0, width, height);
                if (hover_detail !== null) {
                    let { drag_x, drag_y } = hover_detail;
                    ctx.translate(drag_x, drag_y);
                }
            },
        });
        zones.push({
            priority: 0,
            paint: () => {
                let { offset_x, offset_y, scale } = rez_state;
                for (let { idx } of sim.wp_to_idx) {
                    let y = Math.floor(idx / sim.width) * scale;
                    let x = idx % sim.width * scale + y / 2;
                    x += offset_x;
                    y += offset_y;
                    if (sim.cells[idx].is_rock) {
                        ctx.fillStyle = "gray";
                        ctx.fillRect(x, y, scale * 0.9, scale * 0.9);
                    }
                    let ant_idx = sim.cells[idx].ant;
                    if (ant_idx !== null) {
                        let ant = bang(sim.ants[ant_idx]);
                        switch (ant.color) {
                            case Color.Red: ctx.fillStyle = "red"; break;
                            case Color.Black: ctx.fillStyle = "black"; break;
                            default: never(ant.color);
                        }
                        ctx.fillRect(x, y, scale * 0.9, scale * 0.9);
                    }
                }
            },
        });
        if (rez_state.dragging === null) {
            zones.push({
                priority: 0,
                hitbox: () => true,
                on_left_mouse_down: ({ x, y }) => {
                    console.log("begin drag");
                    set_rez_state(rez_state => ({ ...rez_state, dragging: { start_x: x, start_y: y } }));
                },
            });
        } else {
            zones.push({
                priority: +Infinity,
                hitbox: () => true,
                get_hover_detail(x, y) {
                    let { dragging } = rez_state;
                    if (dragging === null) return null;
                    let { start_x, start_y } = dragging;
                    let drag_x = x - start_x;
                    let drag_y = y - start_y;
                    return { key: `drag_${drag_x}_${drag_y}`, drag_x, drag_y };
                },
                on_left_mouse_up({ x, y }) {
                    let { dragging } = rez_state;
                    if (dragging === null) return;
                    console.log("end drag");
                    let { start_x, start_y } = dragging;
                    set_rez_state({
                        offset_x: rez_state.offset_x + x - start_x,
                        offset_y: rez_state.offset_y + y - start_y,
                        scale: rez_state.scale,
                        dragging: null,
                    });
                },
            })
        };
        return zones;
    };
    return <RezCanvas ui_fn={ui_fn} style={{flexGrow: 1, alignSelf: "stretch" }} />
}

function Timeline(props: {
    food_chart: FoodChart,
    current_step: number,
    set_current_step: (step: number) => void,
}) {
    type HoverDetail = { key: string, step: number };

    let { food_chart, current_step, set_current_step } = props;
    function ui_fn(canvas: HTMLCanvasElement) {
        let zones: Zone<HoverDetail>[] = [];
        let ctx = bang(canvas.getContext("2d"));
        let { width, height } = canvas;
        zones.push({
            priority: -Infinity,
            paint: () => {
                ctx.clearRect(0, 0, width, height);
            },
        });
        zones.push({
            priority: 0,
            hitbox: () => true,
            get_hover_detail (x: number, _y: number): HoverDetail | null {
                let step = Math.floor(NUM_STEPS * x / width);
                if (step >= 0 && step < food_chart.entries.length) {
                    return { key: "" + step, step };
                } else {
                    return null;
                }
            },
            tooltip: ({hover_detail}) => {
                if (hover_detail === null) return null;
                let { step } = hover_detail;
                let entry = food_chart.entries[step];
                return `step: ${step}<br>red hill food: ${entry.red_hill_food}<br>black hill food: ${entry.black_hill_food}`;
            },
            on_left_mouse_down({ hover_detail }) {
                if (hover_detail !== null) {
                    let { step } = hover_detail;
                    set_current_step(step);
                }
            },
            paint({hover_detail}) {
                for (let x = 0; x < width; x++) {
                    let step = Math.floor(NUM_STEPS * x / width);
                    if (step >= food_chart.entries.length) break;
                    let entry = food_chart.entries[step];
                    let total = entry.red_hill_food + entry.black_hill_food + entry.red_ant_food + entry.black_ant_food + entry.unclaimed_food;
                    let y = 0;
                    let y1 = y + height * entry.red_hill_food / total;
                    ctx.fillStyle = "#f00";
                    ctx.fillRect(x, y, 1, y1);
                    y = y1;

                    ctx.fillStyle = "#c54";
                    y1 = y + height * entry.red_ant_food / total;
                    ctx.fillRect(x, y, 1, y1);
                    y = y1;

                    ctx.fillStyle = "#1f1";
                    y1 = y + height * entry.unclaimed_food / total;
                    ctx.fillRect(x, y, 1, y1);
                    y = y1;

                    ctx.fillStyle = "#454";
                    y1 = y + height * entry.black_ant_food / total;
                    ctx.fillRect(x, y, 1, y1);
                    y = y1;

                    y1 = y + height * entry.black_hill_food / total;
                    ctx.fillStyle = "#000";
                    ctx.fillRect(x, y, 1, y1);

                    assert(Math.abs(y1 - height) < 1e-2);
                }
                let y = Math.round(current_step * width / NUM_STEPS) + 0.5;
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(y, 0);
                ctx.lineTo(y, height);
                ctx.stroke();
                if (hover_detail) {
                    let y = Math.round(hover_detail.step * width / NUM_STEPS) + 0.5;
                    ctx.strokeStyle = "#fff";
                    ctx.setLineDash([2, 2]);
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(y, 0);
                    ctx.lineTo(y, height);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            },
        });
        return zones;
    }
    return <RezCanvas ui_fn={ui_fn} update_tooltip={update_tooltip} style={{
        width: "100%",
        height: "150px",
    }} />;
}
