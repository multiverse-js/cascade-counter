import { CascadeCounter } from "../core/Counter";
import { offsetAxisClamped } from "../core/AxisUtils";
import process from "node:process";

const WIDTH = 10;
const HEIGHT = 10;

// Digit order: [x, y]
// Bases:       [WIDTH, HEIGHT]
const grid = CascadeCounter.fromFixedBases([WIDTH, HEIGHT], {
  wrapPolicy: CascadeCounter.WRAP, // infinite wrap-around movement
});

// --- Rendering ---

function printGrid() {
  const [x, y] = grid.values;

  console.clear();
  console.log("WASD Grid Navigation Demo (press Q to quit)");
  console.log(`Grid size: ${WIDTH} x ${HEIGHT}`);
  console.log(`Position: x=${x}, y=${y}\n`);

  for (let row = 0; row < HEIGHT; row++) {
    let line = "";
    for (let col = 0; col < WIDTH; col++) {
      line += (col === x && row === y) ? " X " : " . ";
    }
    console.log(line);
  }
}

// --- Helper functions ---

function up() { offsetAxisClamped(grid, 1, -1); }
function down() { offsetAxisClamped(grid, 1, 1); }
function left() { offsetAxisClamped(grid, 0, -1); }
function right() { offsetAxisClamped(grid, 0, 1); }

// --- Keyboard input setup ---

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", (key: string) => {
  const k = key.toLowerCase();

  if (k === "q") {
    console.clear();
    console.log("Exited.");
    process.exit(0);
  }
  if (k === "w") up();
  if (k === "s") down();
  if (k === "a") left();
  if (k === "d") right();

  printGrid();
});

// --- Start ---

printGrid();
