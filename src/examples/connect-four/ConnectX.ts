import { StringRenderable } from "../../soul/types";
import { CascadeCounter } from "../../soul/Counter";
import { offsetAxis } from "../../soul/Axis";

import { Coord } from "../../space/types";
import { dropAlongAxis, findLine } from "../../space/Space";
import { Vector2 } from "../../space/Vector2";

import { DenseWorld } from "../../reality/DenseWorld";

import { Action } from "../../mind/types";
import { Engine, createActionReducer } from "../../mind/Engine";

import { CellPatch2D } from "../../time/types";
import { Timeline } from "../../time/Timeline";
import { patch2DArray } from "../../time/StateRecorder";

// ---------------------------------------------------------------------------
// Types & interfaces
// ---------------------------------------------------------------------------

export interface ConnectXSettings<T> {
  boardWidth: number;
  boardHeight: number;
  playerTokens: ReadonlyArray<T>;
  emptyToken: T;
  winToken: T;
  winLength: number;
}

export interface ConnectXState<T> {
  readonly board: DenseWorld<T>;
  readonly boardCursor: CascadeCounter;
  readonly playerCursor: CascadeCounter;
  lastMove?: Coord;
  outcome?: ConnextXOutcome;
}

// Fully reconstructable state at a point in time (assuming constant board bounds)
export interface ConnectXSnapshot<T> {
  cells: T[];
  cursorX: number;
  currentPlayerIndex: number;
  outcome?: ConnextXOutcome;
}

// Difference between two snapshots
export interface ConnectXPatch<T> {
  cells: CellPatch2D<T>[];
  cursorX: number;
  currentPlayerIndex?: number;
  outcome?: ConnextXOutcome;
}

export type ConnextXOutcome = "win" | "draw" | "quit";

export type ConnectXAction =
  | Action<"moveLeft">
  | Action<"moveRight">
  | Action<"dropPiece">
  | Action<"quit">;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUADRANTS = Vector2.toArrays(Vector2.quadrants);

const applyConnectXPatch = <T>(
  base: ConnectXSnapshot<T>,
  patch: ConnectXPatch<T>,
  width: number
): ConnectXSnapshot<T> => {
  const next: ConnectXSnapshot<T> = {
    cells: base.cells.slice(),
    cursorX: base.cursorX,
    currentPlayerIndex: base.currentPlayerIndex,
    outcome: base.outcome
  };

  for (const cell of patch.cells) {
    const index = cell.y * width + cell.x;
    next.cells[index] = cell.value;
  }

  if (patch.cursorX !== undefined) {
    next.cursorX = patch.cursorX;
  }
  if (patch.currentPlayerIndex !== undefined) {
    next.currentPlayerIndex = patch.currentPlayerIndex;
  }
  if (patch.outcome !== undefined) {
    next.outcome = patch.outcome;
  }
  return next;
}

// ---------------------------------------------------------------------------
// Core game logic (engine-agnostic)
// ---------------------------------------------------------------------------

export class ConnectXGame<T extends StringRenderable> {
  readonly settings: ConnectXSettings<T>;
  readonly state: ConnectXState<T>;
  readonly timeline: Timeline<ConnectXSnapshot<T>, ConnectXPatch<T>>;

  constructor(settings: ConnectXSettings<T>) {
    this.settings = settings;
    this.state = {
      board: new DenseWorld<T>({
        bounds: [settings.boardWidth, settings.boardHeight],
        strictBounds: true,
        defaultValue: settings.emptyToken
      }),
      boardCursor: CascadeCounter.fromFixedBases(
        [settings.boardWidth]
      ),
      playerCursor: CascadeCounter.fromFixedBases(
        [settings.playerTokens.length]
      )
    };
    this.timeline = new Timeline<ConnectXSnapshot<T>, ConnectXPatch<T>>({
      mode: "patch",
      applyPatch: (base, patch) => applyConnectXPatch(base, patch, settings.boardWidth)
    });
    this.timeline.pushFull(this.takeSnapshot());
  }

  moveCursor(direction: 1 | -1): void {
    offsetAxis(this.state.boardCursor, 0, direction);
  }

  switchPlayer(): void {
    this.state.playerCursor.incrementAt();
  }

  dropPiece(): boolean {
    const { boardCursor, board } = this.state;

    const droppedCoord = dropAlongAxis(
      [boardCursor.values[0], 0],         // (x, y = 0)
      1,                                  // axis 1 = y
      1,                                  // gravity down
      board.bounds,                       // board boundaries
      (coord) => !board.isEmpty(coord)    // blocked if not empty
    );
    if (!droppedCoord) return false;

    board.set(droppedCoord, this.getPlayerToken());
    this.state.lastMove = droppedCoord;

    return true;
  }

  isToken = (coord: Coord): boolean =>
    this.state.board.get(coord) === this.getPlayerToken();

  isWin(): boolean {
    const { lastMove, board } = this.state;
    if (!lastMove) return false;

    const { winToken, winLength } = this.settings;
    const isToken = this.isToken;

    for (const direction of QUADRANTS) {
      const line = findLine(lastMove, direction, winLength, board.bounds, isToken);

      if (line) {
        board.drawLine(line, winToken);
        return true;
      }
    }
    return false;
  }

  isDraw(): boolean {
    const board = this.state.board;
    const [width] = board.bounds;

    for (let x = 0; x < width; x++) {
      if (board.isEmpty([x, 0])) return false;
    }
    return true;
  }

  isCursorAction(action: ConnectXAction): boolean {
    return action.type === "moveLeft" || action.type === "moveRight";
  }

  getPlayerToken(index?: number): T {
    return this.settings.playerTokens[index ?? this.state.playerCursor.values[0]];
  }

  createPatch<T>(
    prev: ConnectXSnapshot<T>,
    next: ConnectXSnapshot<T>
  ): ConnectXPatch<T> {
    const [width, height] = this.state.board.bounds;
    const cells: CellPatch2D<T>[] = patch2DArray(prev.cells, next.cells, width, height);
    const patch: ConnectXPatch<T> = {
      cells: cells,
      cursorX: next.cursorX
    };

    if (prev.currentPlayerIndex !== next.currentPlayerIndex) {
      patch.currentPlayerIndex = next.currentPlayerIndex;
    }
    if (prev.outcome !== next.outcome) {
      patch.outcome = next.outcome;
    }
    return patch;
  }

  takeSnapshot(): ConnectXSnapshot<T> {
    const { board, boardCursor, playerCursor, outcome } = this.state;

    return {
      cells: board.cells,
      cursorX: boardCursor.values[0],
      currentPlayerIndex: playerCursor.values[0],
      outcome
    };
  }

  get nextSnapshot(): ConnectXSnapshot<T> | undefined {
    return this.timeline.getNextSnapshot(() => this.takeSnapshot());
  }

  get outcomeMessage(): string {
    switch (this.state.outcome) {
      case "win":
        return `${this.getPlayerToken()} wins!`;
      case "draw":
        return "It's a draw!";
      case "quit":
        return "Quit";
      default:
        return "Interrupted";
    }
  }
}

// ---------------------------------------------------------------------------
// Reducer: Actions → state transitions
// ---------------------------------------------------------------------------

function connectXActionReducer<T extends StringRenderable>() {
  return createActionReducer<ConnectXGame<T>, ConnectXAction>({
    moveLeft(game) {
      if (game.state.outcome) return game;

      game.moveCursor(-1);
      return game;
    },

    moveRight(game) {
      if (game.state.outcome) return game;

      game.moveCursor(1);
      return game;
    },

    dropPiece(game) {
      if (game.state.outcome) return game;
      if (!game.dropPiece()) return game;

      if (game.isWin()) {
        game.state.outcome = "win";
      } else if (game.isDraw()) {
        game.state.outcome = "draw";
      } else {
        game.switchPlayer();
      }
      return game;
    },

    quit(game) {
      game.state.outcome = "quit";
      return game;
    }
  });
}

// ---------------------------------------------------------------------------
// Engine wrapper (game logic + reducer)
// ---------------------------------------------------------------------------

export class ConnectXEngine<T extends StringRenderable> extends Engine<
  ConnectXGame<T>,
  ConnectXState<T>,
  ConnectXAction
> {
  constructor(game: ConnectXGame<T>) {
    super(
      game,
      game.state,
      connectXActionReducer<T>()
    );
  }
}