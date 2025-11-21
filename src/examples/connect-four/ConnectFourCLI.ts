import * as readline from "readline";
import { createKeyMap } from "../../mind/ActionMap";
import { ConnectFourGame, ConnectFourEngine, ConnectFourAction } from "./ConnectFour";

const keyToAction = createKeyMap<ConnectFourAction>({
  a: { type: "moveLeft" },
  d: { type: "moveRight" },
  w: { type: "dropPiece" },
  q: { type: "quit" }
});

class ConnectFourCLI extends ConnectFourGame {
  private readonly rl: readline.Interface;
  private readonly engine: ConnectFourEngine;

  constructor() {
    super(7, 6);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    this.engine = new ConnectFourEngine(this);
    this.setupInput();
  }

  private setupInput() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      const k = key.toLowerCase();
      const action = keyToAction.match(k);
      if (!action) return;

      this.engine.dispatch(action);
      this.render();
    });
  }

  render() {
    console.clear();

    const { board, caret, result, winnerToken } = this.state;
    const width = board.bounds[0];

    let output = `${this.currentToken}'s Turn\n\n`;

    for (let col = 0; col < width; col++) {
      output += caret.values[0] === col ? " ↓ " : "   ";
    }
    output += "\n"
    output += board.toString(" ") + "\n";
    output += `Caret Position: Column ${caret.values[0] + 1}\n`;

    console.log(output);

    if (result === "won") {
      this.exit(`${winnerToken} wins!`);
    } else if (result === "draw") {
      this.exit("It's a draw!");
    } else if (result === "quit") {
      this.exit("Game over.");
    }
  }

  private exit(message: string) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    this.rl.close();
    console.log(message);
    process.exit(0);
  }
}

const cli = new ConnectFourCLI();

cli.render();