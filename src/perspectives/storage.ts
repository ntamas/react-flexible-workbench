import { areWorkbenchStatesEqualIgnoringSelection } from "./compare";
import { IPerspective, IPerspectiveVisualStyle } from "./perspective";

/**
 * Iterator function that is invoked for each of the perspectives in a
 * perspective storage.
 */
export type PerspectiveIteratorCallback<T> =
    (perspective: IPerspective, id: string, storage: IPerspectiveStorage) => T;

/**
 * Object that maps string keys to IPerspective objects.
 */
export interface IPerspectiveMapping {
  [key: string]: IPerspective;
}

/**
 * Object that specifies the position of a perspective in the perspective
 * storage backend during a move operation.
 */
export type PerspectivePosition = "first" | "last" | number | { before: string } | { after: string } | { at: number };

/**
 * Feature constants that a perspective storage backend may support.
 */
export type PerspectiveStorageFeature = "reordering";

/**
 * Interface specification for objects that know how to store perspectives
 * in some storage backend.
 *
 * Each perspective stored in the backend has a mandatory "base" state and an
 * optional "modified" state that is typically different from the base state.
 * When a perspective is loaded, the storage must return the "modified" state
 * if it exists or the base state otherwise. When a perspective is saved, it
 * is saved into the "modified" state and one must call the
 * <code>persistModifications()</code> method to replace the base state with the
 * modified state. Alternatively, one can call the <code>revertModifications()</code>
 * method to forget the modified state and switch back to the base state.
 */
export interface IPerspectiveStorage {

  /**
   * Iterates over all the perspectives stored in the storage backend, and
   * invokes a function for each of them. Perspectives with pending modifications
   * will present the modified state and not the base state.
   *
   * @param func a function that will be called with each of the perspectives in
   *        the storage backend
   * @return a promise that resolves when all the perspectives have been
   *         iterated over
   */
  forEach: (func: PerspectiveIteratorCallback<void>) => Promise<void>;

  /**
   * Iterates over all the perspectives stored in the storage backend, and
   * invokes a function for the _original_ state of each of them, even if they
   * are modified.
   *
   * @param func a function that will be called with each of the perspectives in
   *        the storage backend
   * @return a promise that resolves when all the perspectives have been
   *         iterated over
   */
  forEachOriginal: (func: PerspectiveIteratorCallback<void>) => Promise<void>;

  /**
   * Retrieves the perspective object with the given ID and returns a promise
   * that resolves to the retrieved perspective or undefined if there is no
   * such perspective.
   *
   * Perspectives with pending modifications will present the modified state
   * and not the base state when the function is invoked.
   */
  get: (id: string) => Promise<IPerspective | undefined>;

  /**
   * Retrieves the perspective object with the given ID and returns a promise
   * that resolves to the retrieved perspective or undefined if there is no
   * such perspective.
   *
   * Perspectives with pending modifications will present their _original_
   * base state and not the modified state when the function is invoked.
   */
  getOriginal: (id: string) => Promise<IPerspective | undefined>;

  /**
   * Returns whether the perspective with the given ID has modifications that
   * are not persisted yet.
   *
   * The function must return false for perspective IDs that do not exist.
   */
  isModified: (id?: string) => boolean;

  /**
   * Retrieves the contents of the perspective with the given ID from the
   * storage. The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves to the
   * retrieved perspective.
   */
  load: (id: string) => Promise<IPerspective>;

  /**
   * Iterates over all the perspectives stored in the storage backend, and
   * invokes a function for each of them. Collects the return values of the
   * function in an array and returns a promise that resolves to the array.
   *
   * Perspectives with pending modifications will present the modified state
   * and not the base state when the function is invoked.
   *
   * @param func a function that will be called with each of the perspectives in
   *        the storage backend
   * @return a promise that resolves to the return values of the invoked
   *         function for each perspective.
   */
  map: <T>(func: PerspectiveIteratorCallback<T>) => Promise<T[]>;

  /**
   * Iterates over all the perspectives stored in the storage backend, and
   * invokes a function for each of them. Collects the return values of the
   * function in an array and returns a promise that resolves to the array.
   *
   * Perspectives with pending modifications will present their _original_
   * base state and not the modified state when the function is invoked.
   *
   * @param func a function that will be called with each of the perspectives in
   *        the storage backend
   * @return a promise that resolves to the return values of the invoked
   *         function for each perspective.
   */
  mapOriginal: <T>(func: PerspectiveIteratorCallback<T>) => Promise<T[]>;

  /**
   * Moves a perspective to a new position in the order in which the storage
   * presents the list of perspectives when iterated over.
   *
   * May throw an Error if the perspective storage does not implement
   * reordering. Call `supports()` to test whether reordering is supported.
   */
  move: (id: string, position: PerspectivePosition) => Promise<void>;

  /**
   * Copies the modified state of the perspective with the given ID over to the
   * base state of the perspective.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   */
  persistModifications: (id: string) => Promise<void>;

  /**
   * Removes the perspective with the given ID.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   *
   * @param  id     the ID of the perspective to remove
   */
  remove: (id: string) => Promise<void>;

  /**
   * Renames the perspective with the given ID.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   *
   * @param  id     the ID of the perspective
   * @param  label  the new label of the perspective
   */
  rename: (id: string, label: string) => Promise<void>;

  /**
   * Clears the modified state of the perspective with the given ID.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   */
  revertModifications: (id: string) => Promise<void>;

  /**
   * Saves the given perspective data into the storage.
   *
   * When the ID is specified and it refers to an existing perspective, the
   * method will update the base state of the perspective and forgets its
   * modified state (if any). When the ID is not specified or it refers to a
   * perspective that does not exist yet, the perspective will be saved into
   * the base state.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   *
   * @param  perspective  the perspective to save
   * @param  id  the ID of the perspective
   * @return the ID of the perspective that was saved
   */
  save: (perspective: IPerspective, id?: string) => Promise<string>;

  /**
   * Adds a function to be called whenever the perspective storage is modified.
   */
  subscribe: (callback: () => void) => void;

  /**
   * Tests whether the perspective storage supports a given feature.
   */
  supports: (feature: PerspectiveStorageFeature) => boolean;

  /**
   * Removes a function to be called whenever the perspective storage is modified.
   */
  unsubscribe: (callback: () => void) => void;

  /**
   * Updates the state stored in the perspective with the given ID in the
   * storage.
   *
   * The new state will be stored in the modified state of the perspective; the
   * base state will be left intact.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   *
   * @param  id     the ID of the perspective
   * @param  state  the new state object to store in the perspective
   */
  update: (id: string, state: any) => Promise<void>;

  /**
   * Renames a perspective or performs a modification of its visual style.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   *
   * @param  id     the ID of the perspective
   * @param  updates  the new visual styles of the perspective
   */
  updateVisualStyle: (id: string, updates: Partial<IPerspectiveVisualStyle>) => Promise<void>;

}

/**
 * Factory methods for different kinds of perspective storage objects.
 */
export class PerspectiveStorage {

  /**
   * Returns a perspective storage object that stores perspectives in the
   * given array.
   */
  public static fromArray(array: IPerspective[] = []): IPerspectiveStorage {
    return new ArrayBasedPerspectiveStorage(array);
  }

}

/**
 * Base class for perspective storage objects.
 */
abstract class PerspectiveStorageBase {
  /**
   * List of subscribers to notify when the perspective storage changes.
   */
  private _subscribers: Array<() => void>;

  /**
   * Constructor.
   */
  constructor() {
    this._subscribers = [];
  }

  public abstract forEach(func: PerspectiveIteratorCallback<any>): Promise<void>;
  public abstract forEachOriginal(func: PerspectiveIteratorCallback<any>): Promise<void>;
  public abstract updateVisualStyle(id: string, updates: Partial<IPerspectiveVisualStyle>): Promise<void>;

  public map = <T>(func: PerspectiveIteratorCallback<T>): Promise<T[]> => {
    const result: T[] = [];
    return this.forEach(
      (perspective: IPerspective, id: string, storage: IPerspectiveStorage) => {
        result.push(func(perspective, id, storage));
      }
    ).then(() => result);
  }

  public mapOriginal = <T>(func: PerspectiveIteratorCallback<T>): Promise<T[]> => {
    const result: T[] = [];
    return this.forEachOriginal(
      (perspective: IPerspective, id: string, storage: IPerspectiveStorage) => {
        result.push(func(perspective, id, storage));
      }
    ).then(() => result);
  }

  public rename = (id: string, label: string): Promise<void> =>
    this.updateVisualStyle(id, { label })

  /**
   * Helper function to convert a PerspectivePosition instance into an array
   * index if we can provide an array that contains the IDs of the perspectives
   * in order.
   */
  protected static convertPerspectivePositionIntoIndexInArray(
    array: string[], position: PerspectivePosition
  ): number {
    const length = array.length;

    if (position === "first") {
      return 0;
    } else if (position === "last") {
      return length;
    } else if (typeof position === "number") {
      return Math.max(Math.min(length, Math.round(position)), 0);
    } else if ("at" in position) {
      return Math.max(Math.min(length, Math.round(position.at)), 0);
    } else if ("before" in position) {
      return array.indexOf(position.before);
    } else if ("after" in position) {
      const index = array.indexOf(position.after);
      return index >= 0 ? (index + 1) : -1;
    } else {
      return -1;
    }
  }

  /**
   * Notifies all subscribers that the perspective storage has changed.
   */
  protected notifySubscribers(): void {
    this._subscribers.forEach(func => func());
  }

  /**
   * Adds a new subscribers to the list of subscribers.
   */
  public subscribe(func: () => void): void {
    this._subscribers.push(func);
  }

  /**
   * Removes a subscriber from the list of subscribers.
   */
  public unsubscribe(func: () => void): void {
    const index = this._subscribers.indexOf(func);
    if (index >= 0) {
      this._subscribers.splice(index, 1);
    }
  }

}

/**
 * Perspective storage object that stores perspectives in an array.
 */
class ArrayBasedPerspectiveStorage extends PerspectiveStorageBase implements IPerspectiveStorage {

  /**
   * Object that stores the base states of the perspectives managed by this
   * storage, keyed by their IDs.
   */
  private _baseStates: IPerspectiveMapping;

  /**
   * Object that stores the modified states of the perspectives managed by this
   * storage, keyed by their IDs.
   */
  private _modifiedStates: IPerspectiveMapping;

  /**
   * Array that stores the preferred order of perspectives as they should appear
   * on the UI.
   */
  private _order: string[];

  /**
   * Constructor.
   *
   * @param  array  the initial content of the perspective storage. This
   *                array is copied by the storage.
   */
  constructor(initialContent?: IPerspective[]) {
    super();

    this._baseStates = {};
    this._order = [];
    this._modifiedStates = {};

    if (initialContent) {
      const save = this.save.bind(this);
      initialContent.forEach(perspective => save(perspective));
    }
  }

  /**
   * @inheritDoc
   */
  public forEach(func: PerspectiveIteratorCallback<void>): Promise<void> {
    this._order.forEach(id =>
      func(this._findById(id) as IPerspective, id, this)
    );
    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public forEachOriginal(func: PerspectiveIteratorCallback<void>): Promise<void> {
    this._order.forEach(id =>
      func(this._findOriginalById(id) as IPerspective, id, this)
    );
    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public get = (id: string): Promise<IPerspective | undefined> => {
    return Promise.resolve(this._findById(id));
  }

  /**
   * @inheritDoc
   */
  public getOriginal = (id: string): Promise<IPerspective | undefined> => {
    return Promise.resolve(this._findOriginalById(id));
  }

  /**
   * @inheritDoc
   */
  public isModified = (id: string): boolean => (
    this._baseStates[id] !== undefined && this._modifiedStates[id] !== undefined
  )

  /**
   * @inheritDoc
   */
  public load(id: string): Promise<IPerspective> {
    const perspective = this._findById(id);
    if (perspective !== undefined) {
      return Promise.resolve(perspective);
    } else {
      return this._perspectiveNotFound(id);
    }
  }

  /**
   * @inheritDoc
   */
  public move(id: string, position: PerspectivePosition): Promise<void> {
    const currentIndex = this._order.indexOf(id);
    if (currentIndex >= 0) {
      const convert = PerspectiveStorageBase.convertPerspectivePositionIntoIndexInArray;
      const desiredIndex = convert(this._order, position);
      if (desiredIndex >= 0 && desiredIndex !== currentIndex) {
        this._order.splice(currentIndex, 1);
        this._order.splice(desiredIndex, 0, id);
        this.notifySubscribers();
      }
    }
    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public persistModifications(id: string): Promise<void> {
    if (this._modifiedStates[id]) {
      this._baseStates[id] = this._modifiedStates[id];
      delete this._modifiedStates[id];

      this.notifySubscribers();
    }

    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public remove(id: string): Promise<void> {
    const index = this._order.indexOf(id);
    let changed = false;

    if (index >= 0) {
      this._order.splice(index, 1);
      changed = true;
    }

    if (this._modifiedStates[id]) {
      delete this._modifiedStates[id];
      changed = true;
    }

    if (this._baseStates[id]) {
      delete this._baseStates[id];
      changed = true;
    }

    if (changed) {
      this.notifySubscribers();
    }

    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public revertModifications(id: string): Promise<void> {
    if (this._modifiedStates[id]) {
      delete this._modifiedStates[id];

      this.notifySubscribers();
    }

    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public save(perspective: IPerspective, id?: string): Promise<string> {
    if (id === undefined || id.length === 0) {
      id = this._findUnusedId();
    }

    if (this._order.indexOf(id) < 0) {
      this._order.push(id);
    }

    this._baseStates[id] = perspective;
    delete this._modifiedStates[id];

    this.notifySubscribers();

    return Promise.resolve(id);
  }

  /**
   * @inheritDoc
   */
  public supports(feature: PerspectiveStorageFeature): boolean {
    switch (feature) {
      case "reordering":
        return true;

      default:
        return false;
    }
  }

  /**
   * @inheritDoc
   */
  public update = (id: string, state: any): Promise<void> => {
    if (this._baseStates[id] === undefined) {
      return this._perspectiveNotFound(id);
    }

    if (areWorkbenchStatesEqualIgnoringSelection(
      state, this._baseStates[id].state
    )) {
      return this.revertModifications(id);
    }

    if (this._modifiedStates[id] === undefined) {
      this._modifiedStates[id] = Object.assign({}, this._baseStates[id]);
    }

    this._modifiedStates[id].state = state;

    this.notifySubscribers();

    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public updateVisualStyle = (id: string, updates: Partial<IPerspectiveVisualStyle>): Promise<void> => {
    if (this._baseStates[id] === undefined) {
      return this._perspectiveNotFound(id);
    }

    this._baseStates[id] = Object.assign(this._baseStates[id], updates);

    if (this._modifiedStates[id] !== undefined) {
      this._modifiedStates[id] = Object.assign(this._modifiedStates[id], updates);
    }

    this.notifySubscribers();

    return Promise.resolve();
  }

  private _findById(id: string): IPerspective | undefined {
    return this._modifiedStates[id] || this._baseStates[id];
  }

  private _findOriginalById(id: string): IPerspective | undefined {
    return this._baseStates[id];
  }

  private _findUnusedId(): string {
    let index = 0;
    while (this._order.indexOf("id" + index) >= 0) {
      index++;
    }
    return "id" + index;
  }

  private _perspectiveNotFound(id: string): Promise<any> {
      return Promise.reject(new Error("Perspective not found: " + id));
  }
}
