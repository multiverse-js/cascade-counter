import { StringRenderable } from "../../soul/types";
import { CascadeCounter } from "../../soul/Counter";
import { offsetAxis } from "../../soul/Axis";

import { Coord } from "../../space/types";
import { dropAlongAxis, findLine } from "../../space/Space";
import { Vector2 } from "../../space/Vector2";

import { DenseWorld } from "../../reality/DenseWorld";

import { Action } from "../../mind/types";
import { Engine, createActionReducer } from "../../mind/Engine";

import { Patch2D } from "../../time/types";
import { Timeline } from "../../time/Timeline";
import { StateRecorder } from "../../time/StateRecorder";
import { patch2D } from "../../time/Patch";

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
  outcome?: ConnectXOutcome;
}

// Fully reconstructable state at a point in time (assuming constant board bounds)
export interface ConnectXSnapshot<T> {
  cells: T[];
  boardCursorIndex: number;
  playerCursorIndex: number;
  outcome?: ConnectXOutcome;
}

// Difference between two snapshots
export interface ConnectXPatch<T> {
  cells: Patch2D<T>[];
  boardCursorIndex?: number;
  playerCursorIndex?: number;
  outcome?: ConnectXOutcome;
}

export type ConnectXOutcome = "win" | "draw" | "quit";

export type ConnectXAction =
  | Action<"moveLeft">
  | Action<"moveRight">
  | Action<"dropPiece">
  | Action<"quit">;

export type ConnectXTimeline<T> = Timeline<
  ConnectXSnapshot<T>,
  ConnectXPatch<T>
>;

export type ConnectXStateRecorder<T> = StateRecorder<
  ConnectXState<T>,
  ConnectXSnapshot<T>,
  ConnectXPatch<T>
>;

// ---------------------------------------------------------------------------
// Time Adapter
// ---------------------------------------------------------------------------

export class ConnectXTimeAdapter<T> {
  private readonly state: ConnectXState<T>;
  private readonly width: number;
  private readonly height: number;

  constructor(state: ConnectXState<T>) {
    this.state = state;
    const [width, height] = this.state.board.bounds;
    this.width = width;
    this.height = height;
  }

  createTimeline(): ConnectXTimeline<T> {
    return new Timeline<ConnectXSnapshot<T>, ConnectXPatch<T>>({
      mode: "patch",
      applyPatch: (base, patch) => this.applyPatch(base, patch)
    });
  }

  createStateRecorder(timeline: ConnectXTimeline<T>): ConnectXStateRecorder<T> {
    const recorder = new StateRecorder<ConnectXState<T>, ConnectXSnapshot<T>, ConnectXPatch<T>>({
      timeline: timeline,
      snapshot: () => this.takeSnapshot(),
      patch: (from, to) => this.createPatch(from, to)
    });

    recorder.pushInitial(this.state);
    return recorder;
  }

  takeSnapshot(): ConnectXSnapshot<T> {
    const { board, boardCursor, playerCursor, outcome } = this.state;

    return {
      cells: board.toArray(),
      boardCursorIndex: boardCursor.values[0],
      playerCursorIndex: playerCursor.values[0],
      outcome
    };
  }

  nextSnapshot = (timeline: ConnectXTimeline<T>): ConnectXSnapshot<T> | undefined =>
    timeline.getNextSnapshot(() => this.takeSnapshot());

  createPatch(prev: ConnectXSnapshot<T>, next: ConnectXSnapshot<T>): ConnectXPatch<T> {
    const patch: ConnectXPatch<T> = {
      cells: patch2D(prev.cells, next.cells, this.width, this.height),
      boardCursorIndex: next.boardCursorIndex
    };

    if (prev.playerCursorIndex !== next.playerCursorIndex) {
      patch.playerCursorIndex = next.playerCursorIndex;
    }
    if (prev.outcome !== next.outcome) {
      patch.outcome = next.outcome;
    }
    return patch;
  }

  applyPatch(base: ConnectXSnapshot<T>, patch: ConnectXPatch<T>): ConnectXSnapshot<T> {
    const next: ConnectXSnapshot<T> = {
      cells: base.cells.slice(),
      boardCursorIndex: base.boardCursorIndex,
      playerCursorIndex: base.playerCursorIndex,
      outcome: base.outcome
    };

    for (const cell of patch.cells) {
      const index = cell.y * this.width + cell.x;
      next.cells[index] = cell.value;
    }
    if (patch.boardCursorIndex !== undefined) {
      next.boardCursorIndex = patch.boardCursorIndex;
    }
    if (patch.playerCursorIndex !== undefined) {
      next.playerCursorIndex = patch.playerCursorIndex;
    }
    if (patch.outcome !== undefined) {
      next.outcome = patch.outcome;
    }
    return next;
  }
}

// ---------------------------------------------------------------------------
// Core game logic (engine-agnostic)
// ---------------------------------------------------------------------------

export class ConnectXGame<T extends StringRenderable> {
  static readonly DIRECTION_COORDS = Vector2.toArrays(Vector2.quadrants);

  readonly settings: ConnectXSettings<T>;
  readonly state: ConnectXState<T>;

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

    for (const direction of ConnectXGame.DIRECTION_COORDS) {
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

  getPlayerToken = (index?: number): T =>
    this.settings.playerTokens[index ?? this.state.playerCursor.values[0]];

  isMoveAction = (action: ConnectXAction): boolean =>
    action.type === "moveLeft" || action.type === "moveRight";

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
// Engine wrapper (game logic + action-to-state-transiton reducer)
// ---------------------------------------------------------------------------

function connectXActionReducer<T extends StringRenderable>() {
  return createActionReducer<ConnectXGame<T>, ConnectXAction>(
    {
      moveLeft(game) {
        game.moveCursor(-1);
      },

      moveRight(game) {
        game.moveCursor(1);
      },

      dropPiece(game) {
        if (!game.dropPiece()) return;

        if (game.isWin()) {
          game.state.outcome = "win";
        } else if (game.isDraw()) {
          game.state.outcome = "draw";
        } else {
          game.switchPlayer();
        }
      },

      quit(game) {
        game.state.outcome = "quit";
      }
    },
    {
      guard: (game) => !game.state.outcome
    }
  );
}

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