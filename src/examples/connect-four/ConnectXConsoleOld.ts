import { StringRenderable } from "../../soul/types";
import { createKeyMap } from "../../mind/Engine";
import { ConnectXGame, ConnectXSettings, ConnectXEngine, ConnectXAction } from "./ConnectX";

const KEY_TO_ACTION = createKeyMap<ConnectXAction>({
  a: { type: "moveLeft" },
  d: { type: "moveRight" },
  w: { type: "dropPiece" },
  q: { type: "quit" }
});

class ConnectXConsole<T extends StringRenderable> extends ConnectXGame<T> {
  private readonly engine: ConnectXEngine<T>;

  constructor(settings: ConnectXSettings<T>) {
    super(settings);

    this.engine = new ConnectXEngine(this);
  }

  start() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (key: string) => {
      if (key === "\u0003") {
        this.exit();
      }
      const action = KEY_TO_ACTION.match(key.toLowerCase());
      if (!action) return;

      this.engine.dispatch(action);
      this.render();

      if (this.state.outcome) {
        this.exit();
      }
    });

    this.render();
  }

  render() {
    console.clear();

    const { board, boardCursor } = this.state;
    const [width] = board.bounds;

    let output = `${this.currentPlayerToken}'s Turn\n\n`;

    for (let col = 0; col < width; col++) {
      output += boardCursor.values[0] === col ? " ↓ " : "   ";
    }
    output += "\n" + board.toString2D(" ") + "\n";
    output += `Cursor Position: Column ${boardCursor.values[0] + 1}`;
    output += "\nControls: A = left, D = right, W = drop, Q = quit\n";

    console.log(output);
  }

  private exit() {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    console.log(`Game over: ${this.outcomeMessage}`);
    process.exit(0);
  }
}

const game = new ConnectXConsole({
  boardWidth: 21,
  boardHeight: 18,
  playerTokens: ["🔴", "🟡"], // player 3 "🟣"
  emptyToken: ".",
  winToken: "🟢",
  winLength: 4
});

game.start();