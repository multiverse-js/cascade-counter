import { createKeyMap } from "../../mind/Reducer";
import { ConnectXGame, ConnectXSettings, ConnectXEngine, ConnectXAction } from "./ConnectX";

const keyToAction = createKeyMap<ConnectXAction>({
  a: { type: "moveLeft" },
  d: { type: "moveRight" },
  w: { type: "dropPiece" },
  q: { type: "quit" }
});

class ConnectXConsole {
  private readonly game: ConnectXGame;
  private readonly engine: ConnectXEngine;

  constructor(settings: ConnectXSettings = {}) {
    this.game = new ConnectXGame(settings);
    this.engine = new ConnectXEngine(this.game);
    this.setupInput();
  }

  private setupInput() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      if (key === "\u0003") { // Ctrl+C
        this.endGame("Interrupted");
        return;
      }
      const action = keyToAction.match(key.toLowerCase());
      if (!action) return;

      this.engine.dispatch(action);
      this.render();

      if (this.game.state.outcome) {
        this.endGame(this.game.outcomeMessage);
      }
    });
  }

  render() {
    console.clear();

    const { board, boardCursor } = this.game.state;
    const [width] = board.bounds;

    let output = `${this.game.currentPlayerToken}'s Turn\n\n`;

    for (let col = 0; col < width; col++) {
      output += boardCursor.values[0] === col ? " ↓ " : "   ";
    }
    output += "\n" + board.toString(" ") + "\n";
    output += `Cursor Position: Column ${boardCursor.values[0] + 1}`;
    output += "\nControls: A = left, D = right, W = drop, Q = quit\n";

    console.log(output);
  }

  private endGame(message: string) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    console.log(`Game over: ${message}`);
    process.exit(0);
  }
}

const cli = new ConnectXConsole({
  //boardWidth: 21,
  //boardHeight: 18,
  //playerTokens: ["🔴", "🟡", "🟣"],
});

cli.render();