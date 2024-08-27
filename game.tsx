import { assert, bang } from "./assert.js";
import * as preact from "./vendor/preact/preact.js";
import { useEffect, useState } from "./vendor/preact/hooks.js";
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

    useEffect(() => {
        if (world === null || brains === null) return;
        let sim = Sim.create({ world, red_brain: brains[0], black_brain: brains[1], seed });
        let step_count = 0;
        let timer_id: number | null = null;
        function run_batch() {
            const BATCH_SIZE = 10000;
            console.time("run batch");
            let new_food_chart_entries: FoodChartEntry[] = [];
            for (let i = 0; i < BATCH_SIZE && step_count < NUM_STEPS; i++) {
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

    let food_chart_rows: preact.JSX.Element[] = [];
    food_chart.entries.forEach((entry, i) => {
        if (i % 1000 !== 0) return;
        food_chart_rows.push(<tr key={i}>
            <td>{i}</td>
            <td>{entry.red_hill_food}</td>
            <td>{entry.black_hill_food}</td>
        </tr>);
    });

    return <>
        <Timeline food_chart={food_chart}/>
        <table>
            <thead>
                <tr>
                    <th>Step</th>
                    <th>Red Hill Food</th>
                    <th>Black Hill Food</th>
                </tr>
            </thead>
            <tbody>
                {food_chart_rows}
            </tbody>
        </table>
    </>
}

type HoverDetail = { key: string, step: number };

function Timeline(props: { food_chart: FoodChart }) {
    let { food_chart } = props;
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
                if (hover_detail) {
                    let y = Math.round(hover_detail.step * width / NUM_STEPS) + 0.5;
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(y, 0);
                    ctx.lineTo(y, height);
                    ctx.stroke();
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
