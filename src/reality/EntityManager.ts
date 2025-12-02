import { EntityId } from "./types";
import { Component } from "../space/Components";

export type ComponentClass<T extends Component> = new (...args: any[]) => T;

export class EntityManager {
  private nextEntityId = 0;
  private readonly entities = new Set<EntityId>();
  private readonly stores = new Map<ComponentClass<any>, Map<EntityId, any>>();

  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(entity: EntityId): void {
    this.entities.delete(entity);
    for (const store of this.stores.values()) {
      store.delete(entity);
    }
  }

  destroyAllEntities(): void {
    const ids = Array.from(this.entities);

    for (const id of ids) {
      this.destroyEntity(id);
    }
  }

  hasEntity(): boolean {
    return this.entities.size > 0;
  }

  get size(): number {
    return this.entities.size;
  }

  addComponent<T extends Component>(component: T): T {
    const ctor = component.constructor as ComponentClass<T>;
    let store = this.stores.get(ctor);
    if (!store) {
      store = new Map<EntityId, T>();
      this.stores.set(ctor, store);
    }
    store.set(component.entity, component);
    return component;
  }

  getComponent<T extends Component>(
    entity: EntityId,
    ctor: ComponentClass<T>
  ): T | undefined {
    const store = this.stores.get(ctor);
    return store?.get(entity);
  }

  removeComponent<T extends Component>(
    entity: EntityId,
    ctor: ComponentClass<T>
  ): void {
    const store = this.stores.get(ctor);
    store?.delete(entity);
  }

  /**
   * Iterate over all entities that have *all* of the given component types.
   * Very simple, not hyper-typed, but works well.
   */
  *view<T extends Component[]>(...ctors: { [K in keyof T]: ComponentClass<T[K]> }): Iterable<[EntityId, ...T]> {
    if (ctors.length === 0) return;

    const [first, ...rest] = ctors;
    const firstStore = this.stores.get(first);
    if (!firstStore) return;

    for (const [entity, firstComp] of firstStore.entries()) {
      let ok = true;
      const comps: Component[] = [firstComp];

      for (const ctor of rest) {
        const store = this.stores.get(ctor);
        const comp = store?.get(entity);
        if (!comp) {
          ok = false;
          break;
        }
        comps.push(comp);
      }

      if (ok) {
        // ts-ignore to keep it simple; types line up with T
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        yield [entity, ...comps] as [EntityId, ...T];
      }
    }
  }
}