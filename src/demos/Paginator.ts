import { CascadeCounter } from "../soul/Counter";

const TOTAL_PAGES = 20;

// Single digit: [pageIndex], base = TOTAL_PAGES
// We use WRAP but guard with tryNext/tryPrev so we never actually wrap.
const pager = CascadeCounter.fromFixedBases([TOTAL_PAGES], {
  wrapPolicy: CascadeCounter.WRAP,
});

function currentIndex(): number {
  return pager.getAt(0); // 0-based
}

function currentPage(): number {
  return currentIndex() + 1; // 1-based for humans
}

let statusMessage = "";

// Navigation helpers
function goFirst() {
  pager.setAt(0, 0);
  statusMessage = "Jumped to first page.";
}

function goLast() {
  pager.setAt(0, TOTAL_PAGES - 1);
  statusMessage = "Jumped to last page.";
}

function nextPage() {
  if (!pager.tryNext()) {
    statusMessage = "Already at last page.";
  } else {
    statusMessage = "";
  }
}

function prevPage() {
  if (!pager.tryPrev({ zeroIsMin: true })) {
    statusMessage = "Already at first page.";
  } else {
    statusMessage = "";
  }
}

// Render current state
function render() {
  console.clear();
  console.log("CascadeCounter Pagination Demo");
  console.log("--------------------------------\n");

  console.log("Controls:");
  console.log("  → or n  : next page");
  console.log("  ← or p  : previous page");
  console.log("  f       : first page");
  console.log("  l       : last page");
  console.log("  q       : quit\n");

  console.log(`Total pages : ${TOTAL_PAGES}`);
  console.log(`Current page: ${currentPage()}`);

  console.log(`Can next?   : ${pager.canNext()}`);
  console.log(`Can prev?   : ${pager.canPrev({ zeroIsMin: true })}`);

  if (statusMessage) {
    console.log(`\nStatus: ${statusMessage}`);
  }
}

// --- Keyboard input setup ---

if (!process.stdin.isTTY) {
  console.error("stdin is not a TTY; raw mode not supported.");
  process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

// Arrow key escape codes:
//   Left  = "\x1B[D"
//   Right = "\x1B[C"
process.stdin.on("data", (key: string) => {
  const lower = key.toLowerCase();

  if (lower === "q") {
    console.clear();
    console.log("Exited pagination demo.");
    process.exit(0);
  }

  if (lower === "n" || key === "\x1B[C") {
    // n or Right Arrow → next
    nextPage();
  } else if (lower === "p" || key === "\x1B[D") {
    // p or Left Arrow → prev
    prevPage();
  } else if (lower === "f") {
    goFirst();
  } else if (lower === "l") {
    goLast();
  }

  render();
});

// --- Start ---

render();
