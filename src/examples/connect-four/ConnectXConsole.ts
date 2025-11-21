import { createKeyMap } from "../../mind/ActionMap";
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
        this.exit("Interrupted.");
        return;
      }
      const action = keyToAction.match(key.toLowerCase());
      if (!action) return;

      this.engine.dispatch(action);
      this.render();

      const message = this.resultMessage;
      if (message !== null) this.exit(message);
    });
  }

  render() {
    console.clear();

    const { board, cursor } = this.game.state;
    const width = board.bounds[0];

    let output = `${this.game.currentPlayerMap.symbol}'s Turn\n\n`;

    for (let col = 0; col < width; col++) {
      output += cursor.values[0] === col ? " ↓ " : "   ";
    }
    output += "\n"
    output += board.toString(" ") + "\n";
    output += `Cursor Position: Column ${cursor.values[0] + 1}`;
    output += "\nControls: A = left, D = right, W = drop, Q = quit\n";

    console.log(output);
  }

  private get resultMessage(): string | null {
    const { result, winnerToken } = this.game.state;

    switch (result) {
      case "win":
        return `${winnerToken} wins!`;
      case "draw":
        return "It's a draw!";
      case "quit":
        return "Quit.";
      default:
        return null;
    }
  }

  private exit(message: string) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    console.log(`Game over: ${message}`);
    process.exit(0);
  }
}

const cli = new ConnectXConsole({
  boardWidth: 21,
  boardHeight: 18,
  playerTokens: ["🔴", "🟡"],
});

cli.render();