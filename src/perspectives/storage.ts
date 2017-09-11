import { IPerspective } from "./perspective";

/**
 * Iterator function that is invoked for each of the perspectives in a
 * perspective storage.
 */
export type PerspectiveIteratorCallback =
    (perspective: IPerspective, id: string, storage: IPerspectiveStorage) => void;

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
   * Array that stores the perspectives managed by this storage.
   */
  private _data: IPerspective[];

  /**
   * Constructor.
   *
   * @param  array  the initial content of the perspective storage. This
   *                array is copied by the storage.
   */
  constructor(initialContent?: IPerspective[]) {
    this._data = (initialContent && initialContent.length > 0) ? initialContent.concat() : [];
  }

  /**
   * @inheritDoc
   */
  public forEach(func: PerspectiveIteratorCallback): void {
    return this._data.forEach(perspective =>
      func(perspective, perspective.id, this)
    );
  }

  /**
   * @inheritDoc
   */
  public load(id: string): Promise<IPerspective> {
    const perspective = this._data.find(value => value.id === id);
    if (perspective !== undefined) {
      return Promise.resolve(perspective);
    } else {
      return Promise.reject(new Error("Perspective not found: " + id));
    }
  }

}
