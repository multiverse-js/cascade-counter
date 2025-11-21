import { CascadeCounter } from "../../core/Counter";
import { offsetAxis } from "../../core/Axis";
import { dropAlongAxis, findLine } from "../../space/Space";
import { generateQuadrantVectors } from "../../space/Vector";
import { DenseWorld } from "../../world/DenseWorld";
import { Coord } from "../../space/types";
import { Action } from "../../action/types";
import { Engine } from "../../action/Engine";
import { createReducer } from "../../action/ActionMap";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export const PLAYER_TOKENS = ["🔴", "🟡"] as const;
export type PlayerToken = (typeof PLAYER_TOKENS)[number];
export type GameResult = "won" | "draw" | "quit";

const WIN_TOKEN = "🟢" as const;
const DIRECTIONS: Coord[] = generateQuadrantVectors(2); // right, down, diags...

export interface ConnectFourState {
  readonly board: DenseWorld<string>;
  readonly caret: CascadeCounter;
  readonly currentPlayer: CascadeCounter;
  lastMove: Coord | null;
  result: GameResult | null;
  winnerToken: PlayerToken | null;
}

export type ConnectFourAction =
  | Action<"moveLeft">
  | Action<"moveRight">
  | Action<"dropPiece">
  | Action<"quit">;

// ---------------------------------------------------------------------------
// Core game logic (engine-agnostic)
// ---------------------------------------------------------------------------

export abstract class ConnectFourGame {
  readonly state: ConnectFourState;

  constructor(boardWidth: number, boardHeight: number) {
    this.state = {
      board: new DenseWorld<string>({
        bounds: [boardWidth, boardHeight],
        strictBounds: true,
        defaultValue: "."
      }),
      caret: CascadeCounter.fromFixedBases([boardWidth]),
      currentPlayer: CascadeCounter.fromFixedBases([2]),
      lastMove: null,
      result: null,
      winnerToken: null
    };
  }

  moveCaret(direction: 1 | -1): void {
    offsetAxis(this.state.caret, 0, direction);
  }

  switchPlayer(): void {
    this.state.currentPlayer.incrementAt();
  }

  dropPiece(): boolean {
    const droppedCoord = dropAlongAxis(
      [this.state.caret.values[0], 0],               // (x, y = 0)
      1,                                             // axis 1 = y
      1,                                             // gravity down
      this.state.board.bounds,                       // board boundaries
      (coord) => !this.state.board.isEmpty(coord)    // blocked if not empty
    );
    if (!droppedCoord) return false;

    this.state.board.set(droppedCoord, this.currentToken);
    this.state.lastMove = droppedCoord;

    return true;
  }

  isWin(): boolean {
    if (!this.state.lastMove) return false;

    for (const direction of DIRECTIONS) {
      const line = findLine(
        this.state.lastMove,
        direction,
        4,
        this.state.board.bounds,
        (coord) => this.state.board.get(coord) === this.currentToken
      );

      if (line) {
        this.state.board.drawLine(line, WIN_TOKEN);
        return true;
      }
    }
    return false;
  }

  isDraw(): boolean {
    const width = this.state.board.bounds[0];

    for (let x = 0; x < width; x++) {
      if (this.state.board.isEmpty([x, 0])) return false;
    }
    return true;
  }

  get currentToken(): PlayerToken {
    return this.state.currentPlayer.mapDigit(0, PLAYER_TOKENS);
  }

  abstract quit(): void;
}

// ---------------------------------------------------------------------------
// Reducer: Actions → state transitions
// ---------------------------------------------------------------------------

export const connectFourReducer = createReducer<ConnectFourGame, ConnectFourAction>({
  moveLeft(game) {
    if (!game.state.result) {
      game.moveCaret(-1);
    }
    return game;
  },

  moveRight(game) {
    if (!game.state.result) {
      game.moveCaret(1);
    }
    return game;
  },

  dropPiece(game) {
    if (!game.state.result && game.dropPiece()) {
      if (game.isWin()) {
        game.state.result = "won";
        game.state.winnerToken = game.currentToken;
      } else if (game.isDraw()) {
        game.state.result = "draw";
      } else {
        game.switchPlayer();
      }
    }
    return game;
  },

  quit(game) {
    game.state.result = "quit";
    return game;
  }
});

// ---------------------------------------------------------------------------
// Engine wrapper (pure logic + reducer)
// ---------------------------------------------------------------------------

export class ConnectFourEngine extends Engine<ConnectFourState, ConnectFourGame, ConnectFourAction> {
  constructor(game: ConnectFourGame) {
    super(game, connectFourReducer);
  }
}