export type WorldPos = { x: number, y: number };

export type WorldCell =
    | "Rock"
    | "Clear"
    | "RedAnthill"
    | "BlackAnthill"
    | { type: "Food", count: number }

export type World = (WorldPos & { cell: WorldCell })[];    
    
export function parse_world(s: string): World {
    let lines = s.trim().split("\n");
    let width = parseInt(lines[0]);
    let height = parseInt(lines[1]);
    let world: World = [];

    for (let y = 0; y < height; y++) {
        let row = lines[y + 2].trim().split(" ");
        for (let x = 0; x < width; x++) {
            let char = row[x];
            let pos = { x, y };
            let cell: WorldCell;

            if (char == "#") {
                cell = "Rock";
            } else if (char == ".") {
                cell = "Clear";
            } else if (char == "+") {
                cell = "RedAnthill";
            } else if (char == "-") {
                cell = "BlackAnthill";
            } else if (/^[1-9]$/.test(char)) {
                cell = { type: "Food", count: parseInt(char) };
            } else {
                throw new Error(`Invalid character: ${char}`);
            }

            world.push({ ...pos, cell });
        }
    }

    return world;
}
