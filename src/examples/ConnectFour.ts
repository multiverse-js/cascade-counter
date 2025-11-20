import { CascadeCounter } from '../core/Counter';
import { offsetAxis } from '../core/AxisUtils';
import { dropAlongAxis, findLine } from '../space/Space';
import { generateQuadrantVectors } from '../space/Vector';
import { Coord } from '../space/types';
import * as readline from 'readline';

class ConnectFour {
  // Check in all 4 directions: right, down, diagonal (down-right), diagonal (up-right)
  private static directions: Coord[] = generateQuadrantVectors(2);

  board: string[][]; // 2D array representing the board
  currentPlayer: string; // 'X' or 'O'
  caret: CascadeCounter; // CascadeCounter for the caret position
  bounds: readonly number[];
  lastMove: Coord | null;

  constructor(boardWidth: number, boardHeight: number) {
    this.bounds = [boardWidth, boardHeight];
    this.board = Array.from({ length: boardHeight }, () => Array(boardWidth).fill(''));
    this.currentPlayer = '🔴'; // X starts
    this.caret = CascadeCounter.fromFixedBases([boardWidth]);
    this.lastMove = null;
  }

  dropPiece(): boolean {
    const droppedCoord = dropAlongAxis(
      [this.caret.values[0], 0], // starting coord (currently at top of the column)
      1, // Apply gravity along the y-axis (column)
      1, // Direction downwards (positive)
      this.bounds, // Board dimensions
      (coord: Coord) => this.board[coord[1]][coord[0]] !== '' // Check if the cell is blocked
    );
    if (!droppedCoord) return false;

    const [x, y] = droppedCoord;
    this.board[y][x] = this.currentPlayer;
    this.lastMove = droppedCoord;

    return true;
  }

  switchPlayer() {
    this.currentPlayer = this.currentPlayer === '🔴' ? '🟡' : '🔴';
  }

  checkWin(): boolean {
    if (!this.lastMove) return false;

    const [x, y] = this.lastMove;

    for (const direction of ConnectFour.directions) {
      const line = findLine(
        [x, y], direction, 4,
        this.bounds,
        (coord) => this.board[coord[1]][coord[0]] === this.currentPlayer
      );
      if (line) {
        for (const [x, y] of line) {
          this.board[y][x] = "🟢";
        }
        return true;
      }
    }

    return false;
  }

  printBoard() {
    console.clear(); // Clear + move cursor to top-left

    let output = '';
    output += `Player ${this.currentPlayer}'s Turn\n\n`;

    // Caret row
    for (let col = 0; col < this.board[0].length; col++) {
      output += this.caret.values[0] === col ? ' ↓ ' : '   ';
    }
    output += '\n';

    // Board grid
    for (let row = 0; row < this.board.length; row++) {
      for (let col = 0; col < this.board[row].length; col++) {
        output += this.board[row][col] === '' ? ' . ' : `${this.board[row][col]} `;
      }
      output += '\n';
    }
    output += `\nCaret Position: Column ${this.caret.values[0] + 1}\n`;
    console.log(output);
  }

  moveCaret(direction: 1 | -1) {
    offsetAxis(this.caret, 0, direction); // Increment the x-axis (left or right)
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const game = new ConnectFour(7, 6);

// --- Input handling ---
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdin.on("data", (key: string) => {
  const k = key.toLowerCase();

  if (k === 'q') {
    console.log("Game over.");
    rl.close();
    return;
  }
  if (k === 'w') {  // Drop piece
    if (game.dropPiece()) {
      if (game.checkWin()) {
        game.printBoard();
        console.log(`${game.currentPlayer} wins!`);
        rl.close();
        return;
      }
      game.switchPlayer();
    }
  } else if (k === 'a') {  // Move left
    game.moveCaret(-1);
  } else if (k === 'd') {  // Move right
    game.moveCaret(1);
  }

  game.printBoard();
});

// Start
game.printBoard();