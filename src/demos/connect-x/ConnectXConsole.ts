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
import { Position2D, Token } from "../../space/Components";
import { clampInt } from "../../utils/MiscUtils";
import { EntityManager } from "../../reality/EntityManager";

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

import { FallingPiecesAnimation } from "./ConnectX";

class ConnectXConsole<T extends StringRenderable> {
  private readonly game: ConnectXGame<T>;
  private readonly engine: ConnectXEngine<T>;
  private readonly state: ConnectXState<T>;
  private readonly machine: ConnectXTimeMachine<T>;
  private readonly manager: EntityManager;
  private readonly ticker: Ticker;
  private readonly animation: FallingPiecesAnimation<T>;

  constructor(settings: ConnectXSettings<T>) {
    this.game = new ConnectXGame(settings);
    this.engine = new ConnectXEngine(this.game);
    this.state = this.game.state;

    this.machine = createConnectXTimeMachine(this.state, {
      mode: "patch",
      topology: "branching"
    });

    this.manager = new EntityManager();
    this.ticker = new Ticker();

    this.animation = new FallingPiecesAnimation(
      { ticker: this.ticker, manager: this.manager, speed: 0.04 },
      {
        onFrame: () => this.renderCurrentWithFallingPieces(),
        onPieceLanded: ({ target }) => {
          const { boardCursor } = this.state;
          const originalCursor = boardCursor.values[0];

          boardCursor.setAt(0, target.vector.x);
          this.engine.dispatch({ type: "dropPiece" });
          this.machine.commit("drop");
          boardCursor.setAt(0, originalCursor);

          this.render();
        }
      }
    );
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
        this.destroyFallingPieces();
        return this.machine.stepBackward();
      }
      case RIGHT_ARROW: {
        this.destroyFallingPieces();
        return this.machine.stepForward();
      }
      case UP_ARROW: {
        const before = this.machine.branchId;
        this.machine.previousBranch();

        if (this.machine.branchId !== before) {
          this.destroyFallingPieces();
          return this.machine.goToEnd();
        }
        return undefined;
      }
      case DOWN_ARROW: {
        const before = this.machine.branchId;
        this.machine.nextBranch();

        if (this.machine.branchId !== before) {
          this.destroyFallingPieces();
          return this.machine.goToEnd();
        }
        return undefined;
      }
      case F_LOWERCASE: {
        this.destroyFallingPieces();
        if (this.machine.timeline.length <= 1) {
          return undefined; // no moves yet; no-op
        }
        return this.machine.goTo(1);
      }
      case L_LOWERCASE: {
        this.destroyFallingPieces();
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
        this.destroyFallingPieces();
        this.engine.dispatch(action);
        this.exit();
        return undefined;
      }
      case "dropPiece": {
        const target = this.game.previewDrop();
        if (!target) return undefined;

        const [targetX, targetY] = target;
        const token = this.game.peekPlayerToken(this.manager.size);

        this.animation.addPiece(targetX, targetY, token);
        return undefined;
      }
      case "moveLeft":
      case "moveRight": {
        this.engine.dispatch(action);
        return this.machine.resolveSnapshot();
      }
    }
  }

  private destroyFallingPieces(): void {
    this.manager.destroyAllEntities();
    this.ticker.stop();
  }

  private render(): void {
    this.renderFrame(this.state.board.getCells());
  }

  private renderCurrentWithFallingPieces(): void {
    const { board } = this.state;
    const [width, height] = board.bounds;
    const cells = board.getCells().slice() as T[];

    for (const [_, pos, token] of this.manager.view(
      Position2D,
      Token<T>
    )) {
      const y = clampInt(pos.vector.y, 0, height - 1);
      const index = y * width + pos.vector.x;

      cells[index] = token.value;
    }

    this.renderFrame(cells);
  }

  private renderFrame(cells: ReadonlyArray<T>): void {
    process.stdout.write("\x1Bc");

    const { board, boardCursor, outcome } = this.state;
    const [width, height] = board.bounds;
    const boardCursorIndex = boardCursor.values[0];

    const token = this.game.peekPlayerToken(this.manager.size);
    const { timeline, branchCount, branchId } = this.machine;

    let output = `${token}'s Turn`;
    output += timeline.isAtPresent() ? "\n\n" : " (Viewing past move)\n\n";

    // cursor row
    for (let x = 0; x < width; x++) {
      output += boardCursorIndex === x ? " ↓ " : "   ";
    }
    output += "\n";

    // board (using provided cells)
    output += gridToString(cells, width, height, {
      defaultValue: board.defaultValue,
      cellPadding: " ",
    }) + "\n";

    // HUD
    output += "Controls: A = left, D = right, W = drop, Q = quit\n";
    output += "          F = skip to first move, L = skip to last move\n";
    output += "          ← = undo move, → = redo move\n";
    output += "          ↓ = previous branch, ↑ = next branch\n\n";
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
  boardWidth: 7 * 4,
  boardHeight: 6 * 4,
  playerTokens: ["🔴", "🟡", "🟣"],
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
});

game.start();