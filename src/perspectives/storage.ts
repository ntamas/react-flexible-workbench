import { IPerspective } from "./perspective";

/**
 * Iterator function that is invoked for each of the perspectives in a
 * perspective storage.
 */
export type PerspectiveIteratorCallback =
    (perspective: IPerspective, id: string, storage: IPerspectiveStorage) => void;

/**
 * Object that maps string keys to IPerspective objects.
 */
export interface IPerspectiveMapping {
  [key: string]: IPerspective;
}

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
   */
  forEach: (func: PerspectiveIteratorCallback) => void;

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
   * Copies the modified state of the perspective with the given ID over to the
   * base state of the perspective.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   */
  persistModifications: (id: string) => Promise<void>;

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
   */
  save: (perspective: IPerspective, id?: string) => Promise<void>;

  /**
   * Adds a function to be called whenever the perspective storage is modified.
   */
  subscribe: (callback: () => void) => void;

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
class PerspectiveStorageBase {
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
  public forEach(func: PerspectiveIteratorCallback): void {
    return this._order.forEach(id =>
      func(this._findById(id) as IPerspective, id, this)
    );
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
  public save(perspective: IPerspective, id?: string): Promise<void> {
    if (id === undefined || id.length === 0) {
      id = this._findUnusedId();
    }

    if (this._order.indexOf(id) < 0) {
      this._order.push(id);
    }

    this._baseStates[id] = perspective;
    delete this._modifiedStates[id];

    this.notifySubscribers();

    return Promise.resolve();
  }

  /**
   * @inheritDoc
   */
  public update = (id: string, state: any): Promise<void> => {
    if (this._baseStates[id] === undefined) {
      return this._perspectiveNotFound(id);
    }

    if (this._modifiedStates[id] === undefined) {
      this._modifiedStates[id] = this._baseStates[id];
    }

    this._modifiedStates[id].state = state;

    this.notifySubscribers();

    return Promise.resolve();
  }

  private _findById(id: string): IPerspective | undefined {
    return this._modifiedStates[id] || this._baseStates[id];
  }

  private _findIndexById(id: string): number {
    return this._order.indexOf(id);
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
