import {
  ConnectXGame,
  ConnectXSettings,
  ConnectXAction,
  ConnectXEngine,
  ConnectXTimeAdapter,
  ConnectXTimeline,
  ConnectXStateRecorder,
  ConnectXSnapshot
} from "./ConnectX";

import { StringRenderable } from "../../soul/types";
import { createKeyMap } from "../../mind/Engine";
import { gridToString } from "../../reality/DenseWorld";

const CTRL_C = "\u0003";
const LEFT_ARROW = "\u001b[D";
const RIGHT_ARROW = "\u001b[C";

const KEY_MAP = createKeyMap<ConnectXAction>({
  a: { type: "moveLeft" },
  d: { type: "moveRight" },
  w: { type: "dropPiece" },
  q: { type: "quit" }
});

class ConnectXConsole<T extends StringRenderable> extends ConnectXGame<T> {
  private readonly engine: ConnectXEngine<T>;
  private readonly adapter: ConnectXTimeAdapter<T>;
  private readonly timeline: ConnectXTimeline<T>;
  private readonly recorder: ConnectXStateRecorder<T>;

  constructor(settings: ConnectXSettings<T>) {
    super(settings);

    this.engine = new ConnectXEngine(this);
    this.adapter = new ConnectXTimeAdapter(this.state);
    this.timeline = this.adapter.createTimeline();
    this.recorder = this.adapter.createStateRecorder(this.timeline);
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
          const snapshot = this.adapter.applyCurrentSnapshot(this.timeline);
          this.render();
        }
        return;
      }
      if (key === RIGHT_ARROW) {
        if (this.timeline.stepForward()) {
          const snapshot = this.adapter.applyCurrentSnapshot(this.timeline);
          this.render();
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
    switch (action.type) {
      case "quit": {
        this.engine.dispatch(action);
        return true;
      }
      case "dropPiece": {
        // only piece drops are recorded on the timeline
        this.recorder.commit(this.state);
        this.engine.dispatch(action);
        this.recorder.push(this.state);
        return false;
      }
      // moveLeft / moveRight (no timeline record)
      default: {
        this.engine.dispatch(action);
        return false;
      }
    }
  }

  private render(snapshot?: ConnectXSnapshot<T>) {
    const snapshotFinal = snapshot ?? this.adapter.nextSnapshot(this.timeline);
    if (!snapshotFinal) return;

    console.clear();

    const { cells, outcome } = snapshotFinal;
    const { board, boardCursor, playerCursor } = this.state;

    // cursors: always read from *live* state
    const boardCursorIndex = boardCursor.values[0];
    const playerCursorIndex = playerCursor.values[0];
    const [width, height] = board.bounds;
    const token = this.getPlayerToken(playerCursorIndex);

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
    if (outcome) {
      output += `Outcome: ${token} ${outcome}\n`;
    }

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
  playerTokens: ["🔴", "🟡"],
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
});

game.start();