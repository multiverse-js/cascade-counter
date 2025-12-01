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
import { Ticker } from "../../time/Ticker";

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

interface FallingPiece<T> {
  column: number;   // x index on the board
  fromY: number;    // starting y (usually 0 or -1)
  toY: number;      // target y cell (integer row)
  currentY: number; // current animated y (can be fractional)
  token: T;         // whatever your player token type is
}

class ConnectXConsole<T extends StringRenderable> {
  private readonly game: ConnectXGame<T>;
  private readonly engine: ConnectXEngine<T>;
  private readonly state: ConnectXState<T>;
  private readonly machine: ConnectXTimeMachine<T>;
  private readonly ticker: Ticker;

  private fallingPiece: FallingPiece<T> | undefined;

  constructor(settings: ConnectXSettings<T>) {
    this.game = new ConnectXGame(settings);
    this.engine = new ConnectXEngine(this.game);
    this.state = this.game.state;

    this.machine = createConnectXTimeMachine(this.state, {
      mode: "patch",
      topology: "branching"
    });
    this.ticker = new Ticker();

    const speed = 0.01; // rows per ms

    // Single tick handler for the life of the console
    this.ticker.onTick((dtMs) => {
      if (!this.fallingPiece) return;

      this.fallingPiece.currentY += speed * dtMs;

      if (this.fallingPiece.currentY >= this.fallingPiece.toY) {
        this.fallingPiece.currentY = this.fallingPiece.toY;

        const originalCursor = this.state.boardCursor.values[0];

        // Temporarily set cursor to the latched column
        this.state.boardCursor.setAt(0, this.fallingPiece.column);

        // Let the engine/game handle win/draw/switchPlayer logic
        this.engine.dispatch({ type: "dropPiece" });
        this.machine.commit("drop");

        this.state.boardCursor.setAt(0, originalCursor);

        this.fallingPiece = undefined;
        this.ticker.stop();
        this.render();
      } else {
        this.renderCurrentWithFallingPiece();
      }
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
        this.cancelAnimation();
        return this.machine.stepBackward(1);
      }
      case RIGHT_ARROW: {
        this.cancelAnimation();
        return this.machine.stepForward(1);
      }
      case UP_ARROW: {
        this.cancelAnimation();
        this.machine.nextBranch();
        return this.machine.goToEnd();
      }
      case DOWN_ARROW: {
        this.cancelAnimation();
        this.machine.previousBranch();
        return this.machine.goToEnd();
      }
      case F_LOWERCASE: {
        this.cancelAnimation();
        if (this.machine.timeline.length <= 1) {
          return undefined; // no moves yet; no-op
        }
        return this.machine.goTo(1);
      }
      case L_LOWERCASE: {
        this.cancelAnimation();
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

    switch (action.type) {
      case "quit": {
        this.engine.dispatch(action);
        this.exit();
        return undefined;
      }
      case "dropPiece": {
        // If already animating a piece, ignore extra drops
        if (this.fallingPiece) return undefined;

        const target = this.game.previewDrop();
        if (!target) return undefined;

        const [targetX, targetY] = target;

        this.fallingPiece = {
          column: targetX,
          fromY: 0,
          toY: targetY,
          currentY: 0,
          token: this.game.getPlayerToken(), // current player
        };

        // Ensure we only attach the tick handler once (do this in constructor ideally)
        this.ticker.start();
        return undefined; // don't dispatch / commit yet
      }
      case "moveLeft":
      case "moveRight": {
        this.engine.dispatch(action);
        return this.machine.resolveSnapshot();
      }
    }
  }

  private cancelAnimation(): void {
    if (!this.fallingPiece) return;
    this.fallingPiece = undefined;
    this.ticker.stop();
  }

  private render(): void {
    const { board } = this.state;
    this.renderFrame(board.getCells());
  }

  private renderCurrentWithFallingPiece(): void {
    const { board } = this.state;
    const [width, height] = board.bounds;

    // start from current board cells
    const cells = board.getCells().slice() as T[];

    if (this.fallingPiece) {
      const { column, currentY, token } = this.fallingPiece;

      // clamp & quantize Y to an integer row
      const y = Math.max(0, Math.min(height - 1, Math.floor(currentY)));
      if (column >= 0 && column < width) {
        const index = y * width + column;
        cells[index] = token;
      }
    }

    this.renderFrame(cells);
  }

  private renderFrame(cells: ReadonlyArray<T>): void {
    process.stdout.write("\x1Bc");

    const { board, boardCursor, playerCursor, outcome } = this.state;
    const [width, height] = board.bounds;
    const boardCursorIndex = boardCursor.values[0];

    const token = this.game.getPlayerToken(playerCursor.values[0]);
    const { timeline, branchCount, branchId } = this.machine;

    let output = `${token}'s Turn`;
    output += timeline.isAtPresent() ? "\n\n" : " (Viewing past move)\n\n";

    // cursor row
    for (let x = 0; x < width; x++) {
      output += boardCursorIndex === x ? " ↓ " : "   ";
    }
    output += "\n";

    // board (using provided cells)
    output +=
      gridToString(cells, width, height, {
        defaultValue: board.defaultValue,
        cellPadding: " ",
      }) + "\n";

    // HUD
    output += "Controls: A = left, D = right, W = drop, Q = quit\n";
    output += "          F = skip to first move, L = skip to last move\n";
    output += "          ← = undo move, → = redo move\n";
    output += "          ↓ = previous branch, ↑ = next branch, \n\n";
    output += `Cursor Position: Column ${boardCursorIndex + 1}\n`;
    output += `Move: ${timeline.index}/${timeline.length - 1}\n`;
    output += `Timeline branch: ${branchId + 1}/${branchCount}\n`;
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
  boardWidth: 7,
  boardHeight: 6,
  playerTokens: ["🔴", "🟡", "🟣"],
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
});

game.start();