import { CascadeCounter } from "../../soul/Counter";
import { offsetAxis } from "../../soul/Axis";
import { TokenMap } from "../../soul/TokenMap";
import { dropAlongAxis, findLine } from "../../space/Space";
import { generateQuadrantVectors } from "../../space/Vector";
import { DenseWorld } from "../../reality/DenseWorld";
import { Coord } from "../../space/types";
import { Action } from "../../mind/types";
import { Engine } from "../../mind/Engine";
import { createReducer } from "../../mind/ActionMap";

// ---------------------------------------------------------------------------
// Types & interfaces
// ---------------------------------------------------------------------------

export interface ConnectXSettings {
  boardWidth?: number;
  boardHeight?: number;
  playerTokens?: ReadonlyArray<string>;
  emptyToken?: string;
  winToken?: string;
  winLength?: number;
}

export interface ConnectXState {
  readonly board: DenseWorld<string>;
  readonly cursor: CascadeCounter;
  readonly currentPlayer: CascadeCounter;
  lastMove?: Coord;
  result?: ConnectXResult;
  winnerToken?: string;
}

export type ConnectXAction =
  | Action<"moveLeft">
  | Action<"moveRight">
  | Action<"dropPiece">
  | Action<"quit">;

export type ConnectXResult = "win" | "draw" | "quit";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIRECTIONS = generateQuadrantVectors(2); // right, down, diags...

const DEFAULT_SETTINGS = {
  boardWidth: 7,
  boardHeight: 6,
  playerTokens: ["🔴", "🟡"],
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
} satisfies Required<ConnectXSettings>;

// ---------------------------------------------------------------------------
// Core game logic (engine-agnostic)
// ---------------------------------------------------------------------------

export class ConnectXGame {
  readonly settings: Required<ConnectXSettings>;
  readonly state: ConnectXState;
  readonly currentPlayerMap: TokenMap<string>;

  constructor(settings: ConnectXSettings = {}) {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...settings,
    };;
    this.state = {
      board: new DenseWorld<string>({
        bounds: [this.settings.boardWidth, this.settings.boardHeight],
        strictBounds: true,
        defaultValue: this.settings.emptyToken
      }),
      cursor: CascadeCounter.fromFixedBases(
        [this.settings.boardWidth]
      ),
      currentPlayer: CascadeCounter.fromFixedBases(
        [this.settings.playerTokens.length]
      )
    };
    this.currentPlayerMap = new TokenMap(
      this.state.currentPlayer, 0,
      this.settings.playerTokens
    );
  }

  movecursor(direction: 1 | -1): void {
    offsetAxis(this.state.cursor, 0, direction);
  }

  switchPlayer(): void {
    this.state.currentPlayer.incrementAt();
  }

  dropPiece(): boolean {
    const { cursor, board } = this.state;

    const droppedCoord = dropAlongAxis(
      [cursor.values[0], 0],               // (x, y = 0)
      1,                                  // axis 1 = y
      1,                                  // gravity down
      board.bounds,                       // board boundaries
      (coord) => !board.isEmpty(coord)    // blocked if not empty
    );
    if (!droppedCoord) return false;

    board.set(droppedCoord, this.currentPlayerMap.symbol);
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
        (coord) => board.get(coord) === this.currentPlayerMap.symbol
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
}

// ---------------------------------------------------------------------------
// Reducer: Actions → state transitions
// ---------------------------------------------------------------------------

export const connectXReducer = createReducer<ConnectXGame, ConnectXAction>({
  moveLeft(game) {
    if (!game.state.result) game.movecursor(-1);
    return game;
  },

  moveRight(game) {
    if (!game.state.result) game.movecursor(1);
    return game;
  },

  dropPiece(game) {
    if (!game.state.result && game.dropPiece()) {
      if (game.isWin()) {
        game.state.result = "win";
        game.state.winnerToken = game.currentPlayerMap.symbol;
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
// Engine wrapper (game logic + reducer)
// ---------------------------------------------------------------------------

export class ConnectXEngine extends Engine<
  ConnectXState,
  ConnectXGame,
  ConnectXAction
> {
  constructor(game: ConnectXGame) {
    super(game, connectXReducer);
  }
}