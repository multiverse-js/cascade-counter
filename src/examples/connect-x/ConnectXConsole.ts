import {
  ConnectXGame,
  ConnectXSettings,
  ConnectXAction,
  ConnectXEngine,
  ConnectXTimeAdapter,
  ConnectXTimeline,
  ConnectXStateRecorder
} from "./ConnectX";

import { StringRenderable } from "../../soul/types";
import { createKeyMap } from "../../mind/Engine";
import { DenseWorld } from "../../reality/DenseWorld";

const KEY_TO_ACTION = createKeyMap<ConnectXAction>({
  a: { type: "moveLeft" },
  d: { type: "moveRight" },
  w: { type: "dropPiece" },
  q: { type: "quit" }
});

const CTRL_C = "\u0003";
const LEFT_ARROW = "\u001b[D";
const RIGHT_ARROW = "\u001b[C";

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
      switch(key) {
        case CTRL_C:
          this.exit();
        case LEFT_ARROW:
          if (this.timeline.stepBackward()) this.render();
          return;
        case RIGHT_ARROW:
          if (this.timeline.stepForward()) this.render();
          return;
      }
      const action = KEY_TO_ACTION.match(key.toLowerCase());
      if (!action) return;

      this.processAction(action);
      this.render();

      if (action.type === "quit") {
        this.exit();
      }
    });

    this.render();
  }

  private processAction(action: ConnectXAction) {
    if (!this.timeline.isAtLatest()) {
      this.timeline.moveToLast();
    }
    const isPieceDrop = action.type === "dropPiece";
    if (isPieceDrop) {
      this.recorder.commit(this.state); // baseline snapshot
    }
    this.engine.dispatch(action);
    if (isPieceDrop) {
      this.recorder.push(this.state); // compute patch vs baseline + push
    }
  }

  private render() {
    console.clear();

    const snapshot = this.adapter.nextSnapshot(this.timeline);
    if (!snapshot) return;

    const { boardCursorIndex, playerCursorIndex, cells, outcome } = snapshot;
    const [width, height] = this.state.board.bounds;
    const token = this.getPlayerToken(playerCursorIndex);

    let output = `${token}'s Turn\n\n`;
    for (let col = 0; col < width; col++) {
      output += boardCursorIndex === col ? " ↓ " : "   ";
    }
    output += "\n";
    output += DenseWorld.toStringFromData2D(
      cells, width, height,
      {
        defaultValue: this.state.board.defaultValue,
        cellPadding: " "
      }
    ) + "\n";
    output += "Controls: A = left, D = right, W = drop, Q = quit, ← = undo move, → = redo move\n";
    output += `Move: ${this.timeline.index + 1}/${this.timeline.length}\n`;
    output += `Cursor Position: Column ${boardCursorIndex + 1}\n`;
    if (outcome) output += `Outcome: ${token} ${outcome}\n`;

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
  boardWidth: 21,
  boardHeight: 18,
  playerTokens: ["🔴", "🟡", "🟣"],
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
});

game.start();
