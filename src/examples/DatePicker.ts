import { CascadeCounter } from "../core/Counter";

// --- Utility: leap year check ---
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// --- Utility: days in a month ---
function daysInMonth(month: number, year: number): number {
  const thirtyOne = [0, 2, 4, 6, 7, 9, 11];
  const thirty = [3, 5, 8, 10];

  if (thirtyOne.includes(month)) return 31;
  if (thirty.includes(month)) return 30;
  if (month === 1) return isLeapYear(year) ? 29 : 28;
  throw new Error("Invalid month");
}

// --- Dynamic base resolver ---
const getBase = (level: number, values: ReadonlyArray<number>): number => {
  const [day, month, year] = values;

  if (level === 0) {
    // Base for day depends on month & year
    return daysInMonth(month, year);
  }
  if (level === 1) {
    // Month base fixed at 12
    return 12;
  }
  if (level === 2) {
    // Year unbounded
    return Number.MAX_SAFE_INTEGER;
  }
  throw new Error("Invalid level");
};

// --- Initialize date picker ---
const today = new Date();

const dateCounter = new CascadeCounter(getBase, {
  levels: 3,
  initial: [
    today.getDate() - 1,  // CascadeCounter uses 0-based internally
    today.getMonth(),     // Jan=0
    today.getFullYear(),
  ],
  wrapPolicy: CascadeCounter.NONE, // Year is unbounded
});

// Convert counter state to human-readable date
function formattedDate(): string {
  const [day0, month, year] = dateCounter.values;
  const day = day0 + 1; // convert back to 1-based
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function printDate() {
  console.clear();
  console.log("CascadeCounter Date Picker");
  console.log("Use arrow keys or WASD. Press Q to quit.\n");
  console.log("Current date:");
  console.log(`  ${formattedDate()}\n`);

  console.log("Controls:");
  console.log("  w / s   → change day");
  console.log("  a / d   → change month");
  console.log("  up/down → change year");
  console.log("  q       → quit");
}

// --- Input handling ---
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

  // Day
  if (k === "w") dateCounter.decrement(1); // previous day
  if (k === "s") dateCounter.increment(1); // next day

  // Month
  if (k === "a") dateCounter.subAt(1, 1);
  if (k === "d") dateCounter.addAt(1, 1);

  // Year (arrow keys)
  if (key === "\x1B[A") dateCounter.subAt(2, 1); // up arrow
  if (key === "\x1B[B") dateCounter.addAt(2, 1); // down arrow

  printDate();
});

// Start
printDate();
