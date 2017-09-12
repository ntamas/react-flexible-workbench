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
 */
export interface IPerspectiveStorage {

  /**
   * Iterates over all the perspectives stored in the storage backend, and
   * invokes a function for each of them.
   */
  forEach: (func: PerspectiveIteratorCallback) => void;

  /**
   * Retrieves the contents of the perspective with the given ID from the
   * storage. The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves to the
   * retrieved perspective.
   */
  load: (id: string) => Promise<IPerspective>;

  /**
   * Saves the given perspective data into the storage.
   *
   * The operation may be asynchronous for certain storage backends,
   * therefore the function will return a promise that resolves when the
   * operation was successful.
   *
   * @param  perspective  the perspective to save
   * @param  id  the ID of the perspective. When undefined or empty, a new,
   *         unique ID will be generated. Otherwise, when the ID points to
   *         the ID of an existing perspective, the perspective will be
   *         overwritten.
   */
  save: (perspective: IPerspective, id?: string) => Promise<void>;

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
 * Perspective storage object that stores perspectives in an array.
 */
class ArrayBasedPerspectiveStorage implements IPerspectiveStorage {

  /**
   * Object that stores the perspectives managed by this storage, keyed by
   * their IDs.
   */
  private _data: IPerspectiveMapping;

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
    this._data = {};
    this._order = [];

    if (initialContent) {
      initialContent.forEach(perspective => this.save(perspective));
    }
  }

  /**
   * @inheritDoc
   */
  public forEach(func: PerspectiveIteratorCallback): void {
    return this._order.forEach(id =>
      func(this._data[id], id, this)
    );
  }

  /**
   * @inheritDoc
   */
  public load(id: string): Promise<IPerspective> {
    const perspective = this._findById(id);
    if (perspective !== undefined) {
      return Promise.resolve(perspective);
    } else {
      return Promise.reject(new Error("Perspective not found: " + id));
    }
  }

  /**
   * @inheritDoc
   */
  public save = (perspective: IPerspective, id?: string): Promise<void> => {
    if (id === undefined || id.length === 0) {
      id = this._findUnusedId();
    }

    if (this._order.indexOf(id) < 0) {
      this._order.push(id);
    }

    this._data[id] = perspective;
    return Promise.resolve();
  }

  private _findById(id: string): IPerspective | undefined {
    return this._data[id];
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
}
