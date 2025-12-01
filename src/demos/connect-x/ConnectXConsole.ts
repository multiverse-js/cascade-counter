import {
  ConnectXGame,
  ConnectXState,
  ConnectXSettings,
  ConnectXAction,
  ConnectXEngine,
  ConnectXSnapshot,
  ConnectXTimeMachine,
  createConnectXTimeMachine
} from "./ConnectX";

import { StringRenderable } from "../../soul/types";
import { createKeyMap } from "../../mind/Engine";
import { gridToString } from "../../reality/DenseGrid";

const CTRL_C = "\u0003";
const LEFT_ARROW = "\u001b[D";
const RIGHT_ARROW = "\u001b[C";
const UP_ARROW = "\u001b[A";
const DOWN_ARROW = "\u001b[B";
const F_LOWERCASE = "\u0066";
const L_LOWERCASE = "\u006C";

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
  private readonly machine: ConnectXTimeMachine<T>;

  constructor(settings: ConnectXSettings<T>) {
    this.game = new ConnectXGame(settings);
    this.engine = new ConnectXEngine(this.game);
    this.state = this.game.state;

    this.machine = createConnectXTimeMachine(this.state, {
      mode: "patch",
      topology: "branching"
    });
  }

  start() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      if (key === CTRL_C) this.exit();

      // raw key press handler
      if (this.processTimeTravelAction(key)) {
        this.render();
        return;
      }

      // state machine actions (A/D/W/Q)
      const action = KEY_MAP.match(key.toLowerCase());
      if (action && this.processGameAction(action)) {
        this.render();
      }
    });

    this.machine.commit();
    this.render();
  }

  private processTimeTravelAction(key: string): ConnectXSnapshot<T> | undefined {
    switch (key) {
      case LEFT_ARROW: {
        return this.machine.rewind(1);
      }
      case RIGHT_ARROW: {
        return this.machine.fastForward(1);
      }
      case UP_ARROW: {
        this.machine.nextBranch();
        return this.machine.goToEnd();
      }
      case DOWN_ARROW: {
        this.machine.previousBranch();
        return this.machine.goToEnd();
      }
      case F_LOWERCASE: {
        if (this.machine.timeline.length <= 1) {
          return undefined; // no moves yet; no-op
        }
        return this.machine.goTo(1);
      }
      case L_LOWERCASE: {
        if (this.machine.timeline.length <= 1) {
          return undefined; // no moves yet; no-op
        }
        return this.machine.goToEnd();
      }
      default: return undefined;
    }
  }

  private processGameAction(action: ConnectXAction): ConnectXSnapshot<T> | undefined {
    if (this.state.outcome && action.type !== "quit") return undefined;

    this.engine.dispatch(action);

    switch (action.type) {
      case "quit": {
        this.exit();
        return undefined;
      }
      case "dropPiece": {
        return this.machine.commit();
      }
      case "moveLeft":
      case "moveRight": {
        return this.machine.resolveSnapshot();
      }
    }
  }

  private render() {
    process.stdout.write("\x1Bc");

    const { board, boardCursor, playerCursor, outcome } = this.state;
    const [width, height] = board.bounds;
    const boardCursorIndex = boardCursor.values[0];

    const token = this.game.getPlayerToken(playerCursor.values[0]);
    const { timeline, branchCount, currentBranchId } = this.machine;

    let output = `${token}'s Turn`;
    output += timeline.isAtPresent() ? "\n\n" : " (Viewing past move)\n\n";

    // cursor row
    for (let x = 0; x < width; x++) {
      output += boardCursorIndex === x ? " ↓ " : "   ";
    }
    output += "\n";

    // board
    output += gridToString(board.getCells(), width, height, {
      defaultValue: board.defaultValue,
      cellPadding: " "
    }) + "\n";

    // HUD
    output += "Controls: A = left, D = right, W = drop, Q = quit\n";
    output += "          F = skip to first move, L = skip to last move\n";
    output += "          ← = undo move, → = redo move\n\n"
    output += `Cursor Position: Column ${boardCursorIndex + 1}\n`;
    output += `Move: ${timeline.index}/${timeline.length - 1}\n`;
    output += `Timeline branch: ${currentBranchId + 1}/${branchCount}\n`;
    if (outcome) output += `Outcome: ${this.game.outcomeMessage}\n`;

    process.stdout.write(output);
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