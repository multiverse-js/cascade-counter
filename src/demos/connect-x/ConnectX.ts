import { StringRenderable } from "../../soul/types";
import { CascadeCounter } from "../../soul/Counter";
import { offsetAxis } from "../../soul/Axis";

import { Coord, EntityId } from "../../space/types";
import { Vector2 } from "../../space/Vector2";
import { dropAlongAxis, findLine } from "../../space/Space";
import { Component, Position2D, Velocity2D, Token } from "../../space/Components";

import { DenseGrid } from "../../reality/DenseGrid";
import { EntityManager } from "../../reality/EntityManager";
import { Animation, AnimationConfig, AnimationHooks } from "../../reality/Animation";

import { Action } from "../../mind/types";
import { Engine, createActionReducer } from "../../mind/Engine";

import { GridPatch2D, ScalarPatch } from "../../time/types";
import { Timeline } from "../../time/Timeline";
import { TimeMachine, TimeMachineConfig } from "../../time/TimeMachine";

import {
  computeGridPatch2D,
  computeScalarPatch,
  applyGridPatch2D,
  applyScalarPatch
} from "../../time/Patch";


export type ConnectXSettings<T> = {
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly playerTokens: ReadonlyArray<T>;
  readonly emptyToken: T;
  readonly winToken: T;
  readonly winLength: number;
};

export type ConnectXState<T> = {
  readonly board: DenseGrid<T>;
  readonly boardCursor: CascadeCounter;
  readonly playerCursor: CascadeCounter;
  lastMove?: Coord;
  outcome?: ConnectXOutcome;
};

// Fully reconstructable state at a point in time (assuming constant board bounds)
export type ConnectXSnapshot<T> = {
  readonly cells: ReadonlyArray<T>;
  readonly boardCursorIndex: number;
  readonly playerCursorIndex: number;
  readonly outcome?: ConnectXOutcome;
};

// Difference between two snapshots
export type ConnectXPatch<T> = {
  readonly cells: GridPatch2D<T>;
  readonly boardCursorIndex?: ScalarPatch<number>;
  readonly playerCursorIndex?: ScalarPatch<number>;
  readonly outcome?: ScalarPatch<ConnectXOutcome>;
};

export type ConnectXFallingPiece<T> = {
  readonly entity: EntityId;
  readonly position: Position2D;
  readonly target: Target2D;
  readonly token: Token<T>;
}

export type ConnectXOutcome = "win" | "draw" | "quit";

export type ConnectXAction =
  | Action<"moveLeft">
  | Action<"moveRight">
  | Action<"dropPiece">
  | Action<"quit">;

export type ConnectXTimeMachine<T> = TimeMachine<
  ConnectXState<T>,
  ConnectXSnapshot<T>,
  ConnectXPatch<T>
>;

export type ConnectXTimeline<T> = Timeline<
  ConnectXSnapshot<T>,
  ConnectXPatch<T>
>;

// ---------------------------------------------------------------------------
// State history factory (engine-agnostic)
// ---------------------------------------------------------------------------

export function createConnectXTimeMachine<T>(
  state: ConnectXState<T>,
  config: TimeMachineConfig
): ConnectXTimeMachine<T> {
  return new TimeMachine<ConnectXState<T>, ConnectXSnapshot<T>, ConnectXPatch<T>>(
    state,
    config,
    {
      createSnapshot: (state) => {
        const { board, boardCursor, playerCursor, outcome } = state;

        return {
          cells: board.toArray(),
          boardCursorIndex: boardCursor.values[0],
          playerCursorIndex: playerCursor.values[0],
          outcome
        };
      },

      applySnapshotToState: (snapshot, state) => {
        const { board, boardCursor, playerCursor } = state;
        const { cells, boardCursorIndex, playerCursorIndex, outcome } = snapshot;

        board.loadFromArray(cells);
        boardCursor.setAt(0, boardCursorIndex);
        playerCursor.setAt(0, playerCursorIndex);
        state.outcome = outcome;
      },

      createPatch: (prev, next) => {
        const [width, height] = state.board.bounds;

        return {
          cells: computeGridPatch2D(prev.cells, next.cells, width, height),

          boardCursorIndex: computeScalarPatch(
            prev.boardCursorIndex,
            next.boardCursorIndex
          ),

          playerCursorIndex: computeScalarPatch(
            prev.playerCursorIndex,
            next.playerCursorIndex
          ),

          outcome: computeScalarPatch(prev.outcome, next.outcome)
        };
      },

      applyPatchToSnapshot: (base, patch) => {
        return {
          cells: applyGridPatch2D(base.cells, patch.cells, state.board.bounds[0]),

          boardCursorIndex: applyScalarPatch(
            base.boardCursorIndex,
            patch.boardCursorIndex
          ),

          playerCursorIndex: applyScalarPatch(
            base.playerCursorIndex,
            patch.playerCursorIndex
          ),

          outcome: applyScalarPatch(
            base.outcome,
            patch.outcome
          )
        };
      },

      isEmptyPatch: (patch) => {
        return patch.cells.length === 0
          && patch.boardCursorIndex === undefined
          && patch.playerCursorIndex === undefined
          && patch.outcome === undefined
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Entity component system (engine-agnostic)
// ---------------------------------------------------------------------------

export class Target2D extends Component {
  vector: Vector2;

  constructor(entity: EntityId, x: number, y: number) {
    super(entity);
    this.vector = new Vector2(x, y);
  }
}

export interface FallingPiecesAnimationConfig extends AnimationConfig {
  manager: EntityManager;
  speed?: number; // rows per ms (e.g. 0.04)
}

export interface FallingPiecesAnimationHooks<T> extends AnimationHooks {
  onPieceLanded?: (ctx: ConnectXFallingPiece<T>) => void;
}

export class FallingPiecesAnimation<T> extends Animation {
  private readonly manager: EntityManager;
  private readonly speed: number;
  protected readonly hooks: FallingPiecesAnimationHooks<T>;

  constructor(
    config: FallingPiecesAnimationConfig,
    hooks: FallingPiecesAnimationHooks<T> = {}
  ) {
    super(config, hooks); // base stores hooks as AnimationHooks

    this.manager = config.manager;
    this.speed = config.speed ?? 0.04;
    this.hooks = hooks;
  }

  /** Spawn a new falling piece entity. */
  addPiece(column: number, targetY: number, tokenValue: T): void {
    const e = this.manager.createEntity();

    this.manager.addComponent(new Position2D(e, column, 0));
    this.manager.addComponent(new Velocity2D(e, 0, this.speed));
    this.manager.addComponent(new Token<T>(e, tokenValue));
    this.manager.addComponent(new Target2D(e, column, targetY));

    // Ensure animation is running
    this.start();
  }

  /** Cancel all pieces immediately and stop animating. */
  cancel(): void {
    this.manager.destroyAllEntities();
    this.stop();
  }

  /** Main ECS update loop, called once per tick by base Animation. */
  protected update(dtMs: number, _tick: number, _now: number): void {
    if (!this.manager.hasEntity()) {
      // No pieces → nothing to animate
      this.stop();
      return;
    }

    const toDestroy: EntityId[] = [];

    for (const [entity, pos, vel, token, target] of this.manager.view(
      Position2D,
      Velocity2D,
      Token<T>,
      Target2D,
    )) {
      // Integrate velocity
      pos.vector = pos.vector.add(vel.vector.scale(dtMs));

      // Still falling?
      if (pos.vector.y < target.vector.y) {
        continue; // IMPORTANT: don't bail out of the whole update
      }

      // Snap to target row
      pos.vector = new Vector2(pos.vector.x, target.vector.y);
      toDestroy.push(entity);

      this.hooks.onPieceLanded?.({
        entity,
        position: pos,
        target,
        token,
      });
    }

    for (const id of toDestroy) {
      this.manager.destroyEntity(id);
    }

    if (!this.manager.hasEntity()) {
      this.stop();
    }
  }
}

// ---------------------------------------------------------------------------
// Core game logic (engine-agnostic)
// ---------------------------------------------------------------------------

export class ConnectXGame<T extends StringRenderable> {
  static readonly DIRECTION_COORDS = Vector2.toArrays(Vector2.quadrants);

  readonly settings: ConnectXSettings<T>;
  readonly state: ConnectXState<T>;

  constructor(settings: ConnectXSettings<T>) {
    this.settings = settings;
    this.state = {
      board: new DenseGrid<T>({
        bounds: [settings.boardWidth, settings.boardHeight],
        strictBounds: true,
        defaultValue: settings.emptyToken
      }),

      boardCursor: CascadeCounter.fromFixedBases(
        [settings.boardWidth]
      ),

      playerCursor: CascadeCounter.fromFixedBases(
        [settings.playerTokens.length]
      )
    };
  }

  moveCursor(direction: 1 | -1): void {
    offsetAxis(this.state.boardCursor, 0, direction);
  }

  switchPlayer(): void {
    this.state.playerCursor.incrementAt();
  }

  previewDrop(): Coord | null {
    const { boardCursor, board } = this.state;
    return dropAlongAxis(
      [boardCursor.values[0], 0],         // (x, y = 0)
      1,                                  // axis 1 = y
      1,                                  // gravity down
      board.bounds,                       // board boundaries
      (coord) => !board.isEmpty(coord)    // blocked if not empty
    );
  }

  dropPiece(): boolean {
    const target = this.previewDrop();
    if (!target) return false;

    this.state.board.set(target, this.getPlayerToken());
    this.state.lastMove = target;

    return true;
  }

  private hasToken = (coord: Coord): boolean =>
    this.state.board.get(coord) === this.getPlayerToken();

  isWin(): boolean {
    const { lastMove, board } = this.state;
    if (!lastMove) return false;

    const { winToken, winLength } = this.settings;
    const hasToken = this.hasToken;

    for (const direction of ConnectXGame.DIRECTION_COORDS) {
      const line = findLine(lastMove, direction, winLength, board.bounds, hasToken);

      if (line) {
        board.drawLine(line, winToken);
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

  getPlayerToken = (index?: number): T =>
    this.settings.playerTokens[index ?? this.state.playerCursor.values[0]];

  peekPlayerToken(offset: number = 0) {
    const tokenIndex = this.state.playerCursor.peekWrappedAt(0, offset);
    return this.getPlayerToken(tokenIndex);
  }

  get outcomeMessage(): string {
    switch (this.state.outcome) {
      case "win": return `${this.getPlayerToken()} wins!`;
      case "draw": return "It's a draw!";
      case "quit": return "Quit";
      default: return "Interrupted";
    }
  }
}

// ---------------------------------------------------------------------------
// Engine wrapper (game logic + action reducer)
// ---------------------------------------------------------------------------

export class ConnectXEngine<T extends StringRenderable> extends Engine<
  ConnectXGame<T>,
  ConnectXState<T>,
  ConnectXAction
> {
  constructor(game: ConnectXGame<T>) {
    super(
      game,
      game.state,
      createActionReducer<ConnectXGame<T>, ConnectXAction>(
        {
          moveLeft: (game) => game.moveCursor(-1),
          moveRight: (game) => game.moveCursor(1),

          dropPiece(game) {
            if (!game.dropPiece()) return;

            if (game.isWin()) {
              game.state.outcome = "win";
            } else if (game.isDraw()) {
              game.state.outcome = "draw";
            } else {
              game.switchPlayer();
            }
          },

          quit(game) {
            game.state.outcome = "quit";
          }
        },
        {
          guard: (game) => !game.state.outcome
        }
      )
    );
  }
}