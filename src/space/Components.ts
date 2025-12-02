import { Vector2 } from "./Vector2";
import { EntityId } from "./types";

export abstract class Component {
  readonly entity: EntityId;

  constructor(entity: EntityId) {
    this.entity = entity;
  }
}

export class Position2D extends Component {
  vector: Vector2;

  constructor(entity: EntityId, x: number, y: number) {
    super(entity);
    this.vector = new Vector2(x, y);
  }
}

export class Velocity2D extends Component {
  vector: Vector2;

  constructor(entity: EntityId, vx: number, vy: number) {
    super(entity);
    this.vector = new Vector2(vx, vy);
  }
}

export class Token<T> extends Component {
  value: T;

  constructor(entity: EntityId, value: T) {
    super(entity);
    this.value = value;
  }
}