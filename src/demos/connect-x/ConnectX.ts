import { StringRenderable } from "../../soul/types";
import { CascadeCounter } from "../../soul/Counter";
import { offsetAxis } from "../../soul/Axis";

import { Coord } from "../../space/types";
import { dropAlongAxis, findLine } from "../../space/Space";
import { Vector2 } from "../../space/Vector2";

import { DenseGrid } from "../../reality/DenseGrid";

import { Action } from "../../mind/types";
import { Engine, createActionReducer } from "../../mind/Engine";

import { Patch2D } from "../../time/types";
import { Timeline } from "../../time/Timeline";
import { StateHistory } from "../../time/StateHistory";
import { computePatch2D } from "../../time/CellPatch";

// ---------------------------------------------------------------------------
// Types & interfaces
// ---------------------------------------------------------------------------

export interface ConnectXSettings<T> {
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly playerTokens: ReadonlyArray<T>;
  readonly emptyToken: T;
  readonly winToken: T;
  readonly winLength: number;
}

export interface ConnectXState<T> {
  readonly board: DenseGrid<T>;
  readonly boardCursor: CascadeCounter;
  readonly playerCursor: CascadeCounter;
  lastMove?: Coord;
  outcome?: ConnectXOutcome;
}

// Fully reconstructable state at a point in time (assuming constant board bounds)
export type ConnectXSnapshot<T> = {
  readonly cells: ReadonlyArray<T>;
  readonly boardCursorIndex: number;
  readonly playerCursorIndex: number;
  readonly outcome?: ConnectXOutcome;
};

// Difference between two snapshots
export interface ConnectXPatch<T> {
  readonly cells: ReadonlyArray<Patch2D<T>>;
  readonly boardCursorIndex?: number;
  readonly playerCursorIndex?: number;
  readonly outcome?: ConnectXOutcome;
}

export type ConnectXOutcome = "win" | "draw" | "quit";

export type ConnectXAction =
  | Action<"moveLeft">
  | Action<"moveRight">
  | Action<"dropPiece">
  | Action<"quit">;

export type ConnectXStateHistory<T> = StateHistory<
  ConnectXState<T>,
  ConnectXSnapshot<T>,
  ConnectXPatch<T>
>;

export type ConnectXTimeline<T> = Timeline<
  ConnectXSnapshot<T>,
  ConnectXPatch<T>
>;

// ---------------------------------------------------------------------------
// Timeline & state recorder adapter (engine-agnostic)
// ---------------------------------------------------------------------------

export function createConnectXStateHistory<T>(
  state: ConnectXState<T>
): ConnectXStateHistory<T> {
  return new StateHistory<ConnectXState<T>, ConnectXSnapshot<T>, ConnectXPatch<T>>(
    state,
    {
      takeSnapshot: (state) => {
        const { board, boardCursor, playerCursor, outcome } = state;

        return {
          cells: board.toArray(),
          boardCursorIndex: boardCursor.values[0],
          playerCursorIndex: playerCursor.values[0],
          outcome
        };
      },

      applySnapshotToState: (snapshot, state) => {
        const { board, boardCursor, playerCursor } = state;
        const { cells, boardCursorIndex, playerCursorIndex, outcome } = snapshot;

        board.loadFromArray(cells);
        boardCursor.setAt(0, boardCursorIndex);
        playerCursor.setAt(0, playerCursorIndex);
        state.outcome = outcome;
      },

      createPatch: (prev, next) => {
        const [width, height] = state.board.bounds;

        return {
          cells: computePatch2D(prev.cells, next.cells, width, height),
          boardCursorIndex: prev.boardCursorIndex !== next.boardCursorIndex
            ? next.boardCursorIndex
            : undefined,
          playerCursorIndex: prev.playerCursorIndex !== next.playerCursorIndex
            ? next.playerCursorIndex
            : undefined,
          outcome: prev.outcome !== next.outcome
            ? next.outcome
            : undefined
        };
      },

      applyPatch: (base, patch) => {
        const cells: Array<T> = base.cells.slice();
        const [width] = state.board.bounds;

        for (const cell of patch.cells) {
          const index = cell.y * width + cell.x;
          cells[index] = cell.value;
        }
        return {
          cells,
          boardCursorIndex: patch.boardCursorIndex ?? base.boardCursorIndex,
          playerCursorIndex: patch.playerCursorIndex ?? base.playerCursorIndex,
          outcome: patch.outcome ?? base.outcome
        };
      },

      isEmptyPatch: (patch) => {
        return patch.cells.length === 0
          && patch.boardCursorIndex === undefined
          && patch.playerCursorIndex === undefined
          && patch.outcome === undefined
      },
    },
    { mode: "patch" }
  );
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
      board: new DenseGrid<T>({
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

  hasToken = (coord: Coord): boolean =>
    this.state.board.get(coord) === this.getPlayerToken();

  isWin(): boolean {
    const { lastMove, board } = this.state;
    if (!lastMove) return false;

    const { winToken, winLength } = this.settings;
    const hasToken = this.hasToken;

    for (const direction of ConnectXGame.DIRECTION_COORDS) {
      const line = findLine(lastMove, direction, winLength, board.bounds, hasToken);

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

  get outcomeMessage(): string {
    switch (this.state.outcome) {
      case "win": return `${this.getPlayerToken()} wins!`;
      case "draw": return "It's a draw!";
      case "quit": return "Quit";
      default: return "Interrupted";
    }
  }
}

// ---------------------------------------------------------------------------
// Engine wrapper (game logic + action-to-state-transiton reducer)
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
      createActionReducer<ConnectXGame<T>, ConnectXAction>(
        {
          moveLeft: (game) => game.moveCursor(-1),
          moveRight: (game) => game.moveCursor(1),

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
      )
    );
  }
}