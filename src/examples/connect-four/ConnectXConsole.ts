import { StringRenderable } from "../../soul/types";
import { createKeyMap } from "../../mind/Engine";
import { DenseWorld } from "../../reality/DenseWorld";
import {
  ConnectXGame,
  ConnectXSettings,
  ConnectXEngine,
  ConnectXAction,
  ConnectXSnapshot
} from "./ConnectX";

const KEY_TO_ACTION = createKeyMap<ConnectXAction>({
  a: { type: "moveLeft" },
  d: { type: "moveRight" },
  w: { type: "dropPiece" },
  q: { type: "quit" }
});

class ConnectXConsole<T extends StringRenderable> extends ConnectXGame<T> {
  private readonly engine: ConnectXEngine<T>;

  constructor(settings: ConnectXSettings<T>) {
    super(settings);

    this.engine = new ConnectXEngine(this);
  }

  start() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      if (key === "\u0003") { // Ctrl+C
        this.exit();
      }
      if (key === "\u001b[D") { // left arrow: previous move
        if (this.timeline.stepBackward()) {
          this.render();
        }
        return;
      }
      if (key === "\u001b[C") { // right arrow: next move
        if (this.timeline.stepForward()) {
          this.render();
        }
        return;
      }

      const action = KEY_TO_ACTION.match(key.toLowerCase());
      if (!action) return;

      if (!this.timeline.isAtLatest()) this.timeline.moveToLast();

      let prev: ConnectXSnapshot<T> | undefined;
      const isCursorMove = this.isCursorAction(action);
      if (!isCursorMove) prev = this.takeSnapshot();

      this.engine.dispatch(action);

      if (prev) {
        const patch = this.createPatch(prev, this.takeSnapshot());
        this.timeline.pushPatch(patch);
      }
      this.render();

      if (this.state.outcome) {
        this.exit();
      }
    });

    this.render();
  }

  render() {
    console.clear();

    const snapshot = this.nextSnapshot;
    if (!snapshot) return;

    const { cursorX, currentPlayerIndex, outcome, cells } = snapshot;
    const [width, height] = this.state.board.bounds;

    let output = `${this.getPlayerToken(currentPlayerIndex)}'s Turn\n\n`;

    for (let col = 0; col < width; col++) {
      output += cursorX === col ? " ↓ " : "   ";
    }
    output += "\n" + DenseWorld.toStringFromData2D(
      cells, width, height,
      {
        defaultValue: this.state.board.defaultValue,
        cellPadding: " "
      }
    );
    output += `Move: ${this.timeline.index + 1}/${this.timeline.length}\n`;
    output += `\nCursor Position: Column ${cursorX + 1}\n`;
    if (outcome) output += `Outcome: ${outcome}\n`;
    output += "Controls: A = left, D = right, W = drop, Q = quit, ←/→ = time travel\n";

    console.log(output);
  }

  private exit() {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    console.log(`Game over: ${this.outcomeMessage}`);
    process.exit(0);
  }
}

const game = new ConnectXConsole({
  boardWidth: 7,
  boardHeight: 6,
  playerTokens: ["🔴", "🟡", "🟣"],
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
});

game.start();
