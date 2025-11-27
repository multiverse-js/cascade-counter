import {
  ConnectXGame,
  ConnectXState,
  ConnectXSettings,
  ConnectXAction,
  ConnectXEngine,
  ConnectXSnapshot,
  ConnectXTimeline,
  ConnectXStateHistory,
  createConnectXStateHistory
} from "./ConnectX";

import { StringRenderable } from "../../soul/types";
import { createKeyMap } from "../../mind/Engine";
import { gridToString } from "../../reality/DenseGrid";

const CTRL_C = "\u0003";
const LEFT_ARROW = "\u001b[D";
const RIGHT_ARROW = "\u001b[C";

const KEY_MAP = createKeyMap<ConnectXAction>({
  a: { type: "moveLeft" },
  d: { type: "moveRight" },
  w: { type: "dropPiece" },
  q: { type: "quit" }
});

class ConnectXConsole<T extends StringRenderable> {
  private readonly game: ConnectXGame<T>;
  private readonly engine: ConnectXEngine<T>;
  private readonly state: ConnectXState<T>;
  private readonly history: ConnectXStateHistory<T>;
  private readonly timeline: ConnectXTimeline<T>;

  constructor(settings: ConnectXSettings<T>) {
    this.game = new ConnectXGame(settings);
    this.engine = new ConnectXEngine(this.game);
    this.state = this.game.state;
    this.history = createConnectXStateHistory(this.state);
    this.timeline = this.history.timeline;
  }

  start() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      // hard exit
      if (key === CTRL_C) {
        this.exit();
        return;
      }
      // time travel (← / →)
      if (key === LEFT_ARROW) {
        if (this.timeline.stepBackward()) {
          const snap = this.history.applySnapshot();
          this.render(snap);
        }
        return;
      }
      if (key === RIGHT_ARROW) {
        if (this.timeline.stepForward()) {
          const snap = this.history.applySnapshot();
          this.render(snap);
        }
        return;
      }

      // state machine actions (A/D/W/Q)
      const action = KEY_MAP.match(key.toLowerCase());
      if (!action) return;

      const quit = this.processAction(action);

      this.render(); // new frame

      if (quit) this.exit();
    });

    this.render(); // initial frame
  }

  private processAction(action: ConnectXAction): boolean {
    if (this.state.outcome && action.type !== "quit") return false;

    switch (action.type) {
      case "quit": {
        this.engine.dispatch(action);
        return true;
      }
      case "dropPiece": {
        this.engine.dispatch(action);
        this.history.recorder.record(this.state); // only piece drops are recorded on the timeline
        return false;
      }
      case "moveLeft":
      case "moveRight": {
        this.engine.dispatch(action);
        return false;
      }
    }
  }

  private render(snapshot?: ConnectXSnapshot<T>) {
    const currentSnapshot = snapshot ?? this.history.resolveSnapshot();
    if (!currentSnapshot) return;

    console.clear();

    const { board, boardCursor, playerCursor } = this.state;
    const { cells, outcome } = currentSnapshot;

    // cursors: always read from *live* state
    const boardCursorIndex = boardCursor.values[0];
    const playerCursorIndex = playerCursor.values[0];
    const [width, height] = board.bounds;
    const token = this.game.getPlayerToken(playerCursorIndex);

    let output = `${token}'s Turn\n\n`;

    // cursor row
    for (let x = 0; x < width; x++) {
      output += boardCursorIndex === x ? " ↓ " : "   ";
    }
    output += "\n";

    // board
    output += gridToString(cells, width, height, {
      defaultValue: board.defaultValue,
      cellPadding: " "
    }) + "\n";

    // HUD
    output += "Controls: A = left, D = right, W = drop, Q = quit, ← = undo move, → = redo move\n";
    output += `Move: ${this.timeline.index + 1}/${this.timeline.length}\n`;
    output += `Cursor Position: Column ${boardCursorIndex + 1}\n`;
    if (outcome) output += `Outcome: ${this.game.outcomeMessage}\n`;

    console.log(output);
  }

  private exit() {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.exit(0);
  }
}

const game = new ConnectXConsole({
  boardWidth: 7 * 4,
  boardHeight: 6 * 4,
  playerTokens: ["🔴", "🟡", "🟣"],
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
});

game.start();