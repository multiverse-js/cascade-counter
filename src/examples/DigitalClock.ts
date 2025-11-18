import { CascadeCounter } from "../core/Counter";

// Create a counter with fixed bases: 60s, 60m, 24h
const clock = CascadeCounter.fromFixedBases([60, 60, 24], {
  wrapPolicy: CascadeCounter.WRAP, // wrap after 23:59:59 → 00:00:00
});

// Initialize to current system time
function syncToNow() {
  const now = new Date();
  const hours = now.getHours();     // 0–23
  const minutes = now.getMinutes(); // 0–59
  const seconds = now.getSeconds(); // 0–59

  clock.set([seconds, minutes, hours]);
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function renderClock() {
  const [seconds, minutes, hours] = clock.values;
  const display = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

  console.clear();
  console.log(`Current time: ${display}`);
}

function tick() {
  clock.increment(0);
  renderClock();
}

// --- Main ---

syncToNow();
renderClock();
setInterval(tick, 100);