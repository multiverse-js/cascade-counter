import { StringRenderable } from "../../soul/types";
import { CascadeCounter } from "../../soul/Counter";
import { offsetAxis } from "../../soul/Axis";

import { Coord } from "../../space/types";
import { dropAlongAxis, findLine } from "../../space/Space";
import { generateQuadrantVectors } from "../../space/Vector";

import { DenseWorld } from "../../reality/DenseWorld";

import { Action } from "../../mind/types";
import { Engine, createActionReducer } from "../../mind/Engine";

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
  outcome?: "win" | "draw" | "quit";
}

export type ConnectXAction =
  | Action<"moveLeft">
  | Action<"moveRight">
  | Action<"dropPiece">
  | Action<"quit">;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIRECTIONS = generateQuadrantVectors(2); // right, down, diags...

// ---------------------------------------------------------------------------
// Core game logic (engine-agnostic)
// ---------------------------------------------------------------------------

export class ConnectXGame<T extends StringRenderable> {
  readonly settings: ConnectXSettings<T>;
  readonly state: ConnectXState<T>;

  constructor(settings: ConnectXSettings<T>) {
    this.settings = settings;
    this.state = {
      board: new DenseWorld<T>({
        bounds: [this.settings.boardWidth, this.settings.boardHeight],
        strictBounds: true,
        defaultValue: this.settings.emptyToken
      }),
      boardCursor: CascadeCounter.fromFixedBases(
        [this.settings.boardWidth]
      ),
      playerCursor: CascadeCounter.fromFixedBases(
        [this.settings.playerTokens.length]
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
      [boardCursor.values[0], 0],               // (x, y = 0)
      1,                                  // axis 1 = y
      1,                                  // gravity down
      board.bounds,                       // board boundaries
      (coord) => !board.isEmpty(coord)    // blocked if not empty
    );
    if (!droppedCoord) return false;

    board.set(droppedCoord, this.currentPlayerToken);
    this.state.lastMove = droppedCoord;

    return true;
  }

  isWin(): boolean {
    const { lastMove, board } = this.state;

    if (!lastMove) return false;

    for (const direction of DIRECTIONS) {
      const line = findLine(
        lastMove,
        direction,
        this.settings.winLength,
        board.bounds,
        (coord) => board.get(coord) === this.currentPlayerToken
      );

      if (line) {
        board.drawLine(line, this.settings.winToken);
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

  get currentPlayerToken(): T {
    return this.settings.playerTokens[this.state.playerCursor.values[0]];
  }

  get outcomeMessage(): string {
    switch (this.state.outcome) {
      case "win":
        return `${this.currentPlayerToken} wins!`;
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

export const connectXReducer = createActionReducer<ConnectXGame<any>, ConnectXAction>({
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

// ---------------------------------------------------------------------------
// Engine wrapper (game logic + reducer)
// ---------------------------------------------------------------------------

export class ConnectXEngine<T extends StringRenderable> extends Engine<
  ConnectXGame<T>,
  ConnectXState<T>,
  ConnectXAction
> {
  constructor(game: ConnectXGame<T>) {
    super(game, game.state, connectXReducer);
  }
}