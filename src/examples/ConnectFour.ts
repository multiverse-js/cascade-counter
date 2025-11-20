import { CascadeCounter } from "../core/Counter";
import { offsetAxis } from "../core/AxisUtils";
import { dropAlongAxis, findLine } from "../space/Space";
import { generateQuadrantVectors } from "../space/Vector";
import { DenseWorld } from "../world/DenseWorld";
import { Coord } from "../space/types";
import * as readline from "readline";

const PLAYER_TOKENS = ["🔴", "🟡"] as const;
const WIN_TOKEN = "🟢" as const;
const DIRECTIONS: Coord[] = generateQuadrantVectors(2); // All unique quadrant directions (right, down, diag, etc.)

class ConnectFour {
  private readonly board: DenseWorld<string>;      // ND array
  private readonly caret: CascadeCounter;          // ND counter for column selection
  private readonly currentPlayer: CascadeCounter;  // ND piece types
  private lastMove: Coord | null;

  constructor(boardWidth: number, boardHeight: number) {
    this.board = new DenseWorld<string>({
      bounds: [boardWidth, boardHeight],  // 2D board
      strictBounds: true,
      defaultValue: ""
    });
    this.caret = CascadeCounter.fromFixedBases([boardWidth]); // 1D counter over columns
    this.currentPlayer = CascadeCounter.fromFixedBases([2]); // 1D counter for piece 2 types
    this.lastMove = null;
  }

  moveCaret(direction: 1 | -1) {
    offsetAxis(this.caret, 0, direction);
  }

  getCurrentPlayerToken() {
    return this.currentPlayer.mapDigit(0, PLAYER_TOKENS);
  }

  switchPlayer() {
    this.currentPlayer.incrementAt();
  }

  dropPiece(): boolean {
    const droppedCoord = dropAlongAxis(
      [this.caret.values[0], 0],                   // (x, y=0)
      1,                                           // axis 1 = y
      1,                                           // gravity down
      this.board.bounds,                           // board boundaries
      (coord) => !this.board.isDefault(coord)      // blocked if not empty
    );
    if (!droppedCoord) return false;

    this.board.set(droppedCoord, this.getCurrentPlayerToken());
    this.lastMove = droppedCoord;

    return true;
  }

  checkWin(): boolean {
    if (!this.lastMove) return false;

    const [x, y] = this.lastMove;

    for (const direction of DIRECTIONS) {
      const line = findLine(
        [x, y], direction, 4,
        this.board.bounds,
        (coord) => this.board.get(coord) === this.getCurrentPlayerToken()
      );

      if (line) {
        this.board.drawLine(line, WIN_TOKEN);
        return true;
      }
    }
    return false;
  }

  printBoard() {
    console.clear();

    let output = `${this.getCurrentPlayerToken()}'s Turn\n\n`;

    const width = this.board.bounds[0];
    for (let col = 0; col < width; col++) {
      output += this.caret.values[0] === col ? " ↓ " : "   ";
    }
    console.log(output);
    console.log(this.board.toString(' '));
    console.log(`Caret Position: Column ${this.caret.values[0] + 1}`);
  }
}

// --- CLI wiring ---

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const game = new ConnectFour(7, 6);

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", (key: string) => {
  const k = key.toLowerCase();

  if (k === "q") {
    console.log("Game over.");
    rl.close();
    return;
  }
  if (k === "w") {
    if (game.dropPiece()) {
      if (game.checkWin()) {
        game.printBoard();
        console.log(`${game.getCurrentPlayerToken()} wins!`);
        rl.close();
        return;
      }
      game.switchPlayer();
    }
  } else if (k === "a") {
    game.moveCaret(-1);
  } else if (k === "d") {
    game.moveCaret(1);
  }

  game.printBoard();
});

game.printBoard();