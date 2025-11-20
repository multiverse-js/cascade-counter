import { CascadeCounter } from "../core/Counter";

// Mixed-radix time:
// [ms, sec, min, hours]
//  0    1    2    3
const getBase = (level: number): number => {
  switch (level) {
    case 0: return 1000; // milliseconds
    case 1: return 60;   // seconds
    case 2: return 60;   // minutes
    case 3: return Number.MAX_SAFE_INTEGER; // hours, effectively unbounded
    default:
      throw new Error(`Invalid level ${level} in getBase()`);
  }
};

// Stopwatch counter
const stopwatch = new CascadeCounter(getBase, {
  levels: 4,
  initial: [0, 0, 0, 0],
  wrapPolicy: CascadeCounter.NONE, // top (hours) is unbounded
});

// State
let running = false;
let lastTimestamp: number | null = null;

// Formatting
function formatTime(): string {
  const [ms, sec, min, hrs] = stopwatch.values;

  const hStr = String(hrs).padStart(2, "0");
  const mStr = String(min).padStart(2, "0");
  const sStr = String(sec).padStart(2, "0");
  const msStr = String(ms).padStart(3, "0");

  return `${hStr}:${mStr}:${sStr}.${msStr}`;
}

function render() {
  console.clear();
  console.log("CascadeCounter Stopwatch Demo");
  console.log("--------------------------------\n");
  console.log("Controls:");
  console.log("  Space : start / pause");
  console.log("  r     : reset");
  console.log("  q     : quit\n");

  console.log(`Running : ${running ? "yes" : "no"}`);
  console.log(`Time    : ${formatTime()}`);
}

// Tick based on real elapsed time
function tick() {
  if (!running) return;

  const now = Date.now();
  if (lastTimestamp == null) {
    lastTimestamp = now;
    return;
  }

  const deltaMs = now - lastTimestamp;
  lastTimestamp = now;

  if (deltaMs > 0) {
    // Add elapsed milliseconds at level 0, letting CascadeCounter
    // handle all cascading (ms → sec → min → hours)
    stopwatch.incrementAt(0, deltaMs);
  }

  render();
}

// --- Keyboard input setup ---

if (!process.stdin.isTTY) {
  console.error("stdin is not a TTY; raw mode not supported.");
  process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", (key: string) => {
  const lower = key.toLowerCase();

  if (lower === "q") {
    console.clear();
    console.log("Exited stopwatch demo.");
    process.exit(0);
  }

  if (key === " ") {
    // Space: toggle running
    running = !running;
    if (running) {
      lastTimestamp = Date.now();
    } else {
      lastTimestamp = null;
    }
    render();
    return;
  }

  if (lower === "r") {
    // Reset
    running = false;
    lastTimestamp = null;
    stopwatch.reset();
    render();
    return;
  }
});

// Timer loop (update ~every 10ms)
setInterval(tick, 10);

// Initial render
render();
