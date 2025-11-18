import { CascadeCounter } from '../core/Counter';
import { dropAlongAxis, incrementAxis } from '../space/Axis';
import { inBounds, hasLine } from '../space/Space'; // Import hasLine from Space
import { Coord } from '../space/types';
import * as readline from 'readline';

class ConnectFourWorld {
  // Check in all 4 directions: right, down, diagonal (down-right), diagonal (up-right)
  private static directions: Coord[] = [
    [1, 0],   // Right (horizontal)
    [0, 1],   // Down (vertical)
    [1, 1],   // Down-right diagonal
    [1, -1],  // Up-right diagonal
  ];

  boardState: string[][]; // 2D array representing the board
  currentPlayer: string; // 'X' or 'O'
  caret: CascadeCounter; // CascadeCounter for the caret position
  maxRows: number;
  maxCols: number;

  constructor(boardWidth: number, boardHeight: number) {
    this.maxCols = boardWidth;
    this.maxRows = boardHeight;
    this.boardState = Array.from({ length: boardHeight }, () => Array(boardWidth).fill(''));
    this.currentPlayer = 'X'; // X starts
    this.caret = CascadeCounter.fromFixedBases([boardWidth, boardHeight]); // Caret is a CascadeCounter with 2D dimensions
  }

  /**
   * Drop a piece using the Space API's dropAlongAxis
   * @returns true if the piece was dropped successfully, false if the column is full.
   */
  dropPiece(): boolean {
    const droppedCoord = dropAlongAxis(
      this.caret, // starting coord (currently at top of the column)
      1, // Apply gravity along the y-axis (column)
      1, // Direction downwards (positive)
      (coord: Coord) => this.boardState[coord[1]][coord[0]]  !== '', // Check if the cell is free (empty)
      [this.maxCols, this.maxRows] // Board dimensions
    );

    console.log("coord: ", droppedCoord);

    if (droppedCoord) {
      console.log("dropped 1");
      this.boardState[droppedCoord[1]][droppedCoord[0]] = this.currentPlayer;
      return true;
    }
    return false; // Column is full
  }

  /**
   * Switch the current player.
   */
  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
  }

  /**
   * Check if the current player has won the game.
   * @returns true if the current player wins.
   */
  checkWin(): boolean {
    for (let row = 0; row < this.boardState.length; row++) {
      for (let col = 0; col < this.boardState[row].length; col++) {
        if (this.boardState[row][col] === this.currentPlayer) {
          // Use the hasLine function from Space to check for a line of 4 in each direction
          for (const direction of ConnectFourWorld.directions) {
            if (hasLine(
              [col, row],
              direction, 4,
              (coord) => inBounds(coord, [this.maxCols, this.maxRows]),
              (coord) => this.boardState[coord[1]][coord[0]] === this.currentPlayer
            )) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Print the board for debugging purposes, including caret position.
   */
  printBoard() {
    console.log(`Player ${this.currentPlayer}'s Turn`);
    for (let row = 0; row < this.boardState.length; row++) {
      let rowStr = '';
      for (let col = 0; col < this.boardState[row].length; col++) {
        // Mark caret position with an arrow '←' for visual clarity
        if (this.caret.values[0] === col && this.caret.values[1] === row) {
          rowStr += ' ← '; // Caret marker
        } else {
          rowStr += this.boardState[row][col] === '' ? ' . ' : ` ${this.boardState[row][col]} `;
        }
      }
      console.log(rowStr);
    }
    console.log(`Caret Position: Column ${this.caret.values[0] + 1}`);
  }

  /**
   * Move the caret left or right.
   * @param direction - 1 to move right, -1 to move left
   */
  moveCaret(direction: 1 | -1) {
    incrementAxis(this.caret, 0, direction); // Increment the x-axis (left or right)
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const game = new ConnectFourWorld(7, 6); // 7 columns, 6 rows

// Handle keyboard inputs for caret movement and piece placement
rl.on('line', (input) => {
  if (input === 'q') {
    console.log("Game over.");
    rl.close();
    return;
  }

  if (input === 'w') {  // Drop piece (simulated with 'w' for simplicity)
    if (game.dropPiece()) {
      console.log("dropped 2");
      if (game.checkWin()) {
        game.printBoard();
        console.log(`${game.currentPlayer} wins!`);
        rl.close();
        return;
      }
      game.switchPlayer();
    }
  } else if (input === 'a') {  // Move left
    game.moveCaret(-1);
  } else if (input === 'd') {  // Move right
    game.moveCaret(1);
  }

  game.printBoard();
});

// Start the game by printing the board
game.printBoard();
