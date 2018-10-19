import { Config, ContentItem } from "golden-layout";
import cloneDeep from "lodash-es/cloneDeep";

import {
  ItemConfigType, IWorkbenchState, WorkbenchStateTransformer
} from "./types";
import { Workbench } from "./workbench";

/**
 * Special symbol that can be fed into a generator that iterates over the
 * content items of a workbench to indicate that the current content item
 * should be removed.
 */
const REMOVE = Symbol("REMOVE");

/**
 * String constants defining the known iteration orders.
 */
export type IterationOrder = "dfsReverse";

export interface IIterationOptions {
  order: IterationOrder;
}

/**
 * Interface specification for generic trees. Used to provide a common
 * framework for iterating over the existing content items of a workbench
 * and for iterating over the panel configuration of a workbench.
 */
interface ITree<T> {
  getRoot: () => T | undefined;
  getChild: (item: T, index: number) => T | undefined;
  replaceChild?: (item: T, index: number, child: T) => void;
  removeChild?: (item: T, index: number) => void;
}

/**
 * Generic reverse depth-first iteration that iterates over a tree specified
 * using an object satisfying ITree<T>.
 */
function dfsReverseIterator<T>(tree: ITree<T>): Iterator<T> {
  const stack: Array<{ item: T, index: number }> = [];
  let started: boolean = false;
  const root = tree.getRoot();

  if (root) {
    stack.push({ index: 0, item: root });
  }

  return {
    next(received: T | typeof REMOVE | undefined): IteratorResult<T> {
      if (received !== undefined) {
        if (!started) {
          throw new Error("not allowed before generator is started");
        } else if (stack.length === 0) {
          throw new Error("not allowed after generator has been exhausted");
        }

        const stackTop = stack[stack.length - 1];

        if (received === REMOVE) {
          if (tree.removeChild !== undefined) {
            stackTop.index--;
            tree.removeChild(stackTop.item, stackTop.index);
          } else {
            throw new Error("iteratee does not allow item removal");
          }
        } else {
          if (tree.replaceChild !== undefined) {
            tree.replaceChild(
              stackTop.item, stackTop.index - 1,
              received
            );
          } else {
            throw new Error("iteratee does not allow item replacement");
          }
        }
      }

      started = true;

      while (stack.length > 0) {
        const entry = stack[stack.length - 1];
        const { item, index } = entry;
        const child = tree.getChild(item, index);

        if (child === undefined) {
          // All children traversed; yield the item itself and pop it
          stack.pop();
          return { done: false, value: item };
        } else {
          // Put the appropriate child on the stack
          entry.index++;
          stack.push({ index: 0, item: child });
        }
      }

      return { done: true } as any;
    },

    return(value: T): IteratorResult<T> {
      stack.length = 0;
      return { done: true, value };
    },

    throw(err: any): IteratorResult<T> {
      throw err;
    }
  };
}

/**
 * Filters an iterator and returns another iterator that yields only those
 * items that match a given condition.
 *
 * @param  iterator  the iterator to filter
 * @param  condition the condition to test
 * @return another iterator that returns only those items that match the given
 *         condition
 */
function filteredIterator<T>(
  iterator: Iterator<T>, condition: (item: T) => boolean
): Iterator<T> {
  const _handleEntry = (entry: IteratorResult<T>): IteratorResult<T> | undefined => {
    if (entry.done) {
      if (entry.hasOwnProperty("value")) {
        const { value } = entry;
        if (condition(value)) {
          return { done: true, value };
        } else {
          return { done: true } as any;
        }
      } else {
        return { done: true } as any;
      }
    } else {
      const { value } = entry;
      if (condition(value)) {
        return { done: false, value };
      } else {
        return undefined;
      }
    }
  };

  return {
    next(received: T | undefined): IteratorResult<T> {
      while (true) {
        const result = _handleEntry(iterator.next(received));
        received = undefined;
        if (result !== undefined) {
          return result;
        }
      }
    },

    return(value: T): IteratorResult<T> {
      const entry = iterator.return ? iterator.return(value) : { done: true } as any;
      return _handleEntry(entry) || { done: true } as any;
    },

    throw(err: any): IteratorResult<T> {
      if (iterator.throw === undefined) {
        throw err;
      }

      const result = _handleEntry(iterator.throw(err));
      if (result !== undefined) {
        return result;
      } else {
        return this.next();
      }
    }
  };
}

/**
 * Creates an ITree object that allows the traversal of the content items of a
 * workbench.
 *
 * @param  workbench  the workbench to traverse
 */
function workbenchAsTree(workbench: Workbench): ITree<ContentItem> {
  return {
    getChild: (item: ContentItem, index: number) => item.contentItems[index],
    getRoot: () => workbench.layout ? workbench.layout.root : undefined
  };
}

/**
 * Creates an ITree object that allows the traversal of the items of a
 * workbench configuration objet.
 *
 * @param  config  the workbench configuration to traverse
 */
function workbenchConfigurationAsTree(config: Config | IWorkbenchState): ITree<ItemConfigType> {
  return {
    getChild: (item: ItemConfigType, index: number) =>
      item.content ? item.content[index] : undefined,
    getRoot: () => (
      config.content ? (
        Array.isArray(config.content) ? (
          config.content.length > 1 ? {
            content: config.content,
            type: "stack"
          } : config.content[0]
        ) : {
          content: config.content,
          type: "stack"
        }
      ) : undefined
    ),
    removeChild: (item: ItemConfigType, index: number) => {
      if (item.content && index >= 0 && index < item.content.length) {
        item.content.splice(index, 1);
      } else {
        throw new Error("index out of bounds: " + index);
      }
    },
    replaceChild: (item: ItemConfigType, index: number, value: ItemConfigType) => {
      if (item.content && index >= 0 && index < item.content.length) {
        item.content[index] = value;
      } else {
        throw new Error("index out of bounds: " + index);
      }
    }
  };
}

/**
 * Iterates over the items of a workbench or workbench configuration
 * according to some iteration order.
 *
 * Both panels (leaf nodes) and containers (rows, columns and stacks) will be
 * returned by the iterator. If you need the panels only, use `panelsIn()`.
 * If you need the containers only, use `containersIn()`.
 *
 * @param  input    the workbench or workbench configuration whose items are
 *                  to be iterated over
 * @param  options   additional options that influence the iterator behaviour
 * @return the iterator
 */
export function itemsIn(
  input: Workbench, options?: Partial<IIterationOptions>
): Iterator<ContentItem>;
export function itemsIn(
  input: Config | IWorkbenchState, options?: Partial<IIterationOptions>
): Iterator<ItemConfigType>;
export function itemsIn(
  input: Workbench | Config | IWorkbenchState,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem | ItemConfigType> {
  const effectiveOptions: IIterationOptions = {
    order: "dfsReverse",
    ...options
  };
  const tree: ITree<ContentItem | ItemConfigType> =
    (input instanceof Workbench)
      ? workbenchAsTree(input)
      : workbenchConfigurationAsTree(input);

  switch (effectiveOptions.order) {
    case "dfsReverse":
      return dfsReverseIterator(tree);

    default:
      throw new Error("unknown iteration order: " + effectiveOptions.order);
  }
}

/**
 * Iterates over the panels of a workbench or a workbench configuration object
 * according to some iteration order.
 *
 * Only panels will be returned by this iterator; containers will be ignored.
 *
 * @param  input    the workbench or workbench configuration whose panels are
 *                  to be iterated over
 * @param  options  additional options that influence the iterator behaviour
 * @return the iterator
 */
export function panelsIn(
  input: Workbench, options?: Partial<IIterationOptions>
): Iterator<ContentItem>;
export function panelsIn(
  input: Config | IWorkbenchState, options?: Partial<IIterationOptions>
): Iterator<ItemConfigType>;
export function panelsIn(
  input: Workbench | Config | IWorkbenchState,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem | ItemConfigType> {
  if (input instanceof Workbench) {
    return filteredIterator(
      itemsIn(input, options),
      item => item.isComponent
    );
  } else {
    return filteredIterator(
      itemsIn(input, options),
      item => item.type !== "row" && item.type !== "column" && item.type !== "stack"
    );
  }
}

/**
 * Iterates over the containers of a workbench or a workbench configuration
 * object according to some iteration order.
 *
 * Only containers will be returned by this iterator; panels will be ignored.
 *
 * @param  input    the workbench or workbench configuration whose containers
 *                  are to be iterated over
 * @param  options   additional options that influence the iterator behaviour
 * @return the iterator
 */
export function containersIn(
  input: Workbench, options?: Partial<IIterationOptions>
): Iterator<ContentItem>;
export function containersIn(
  input: Config | IWorkbenchState, options?: Partial<IIterationOptions>
): Iterator<ItemConfigType>;
export function containersIn(
  input: Workbench | Config | IWorkbenchState,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem | ItemConfigType> {
  if (input instanceof Workbench) {
    return filteredIterator(
      itemsIn(input, options),
      item => !item.isComponent
    );
  } else {
    return filteredIterator(
      itemsIn(input, options),
      item => item.type === "row" || item.type === "column" || item.type === "stack"
    );
  }
}

/**
 * Filters the configuration of a workbench in-place by calling a predicate
 * with each configuration item (panel or container) and removing it if the
 * given predicate returns false.
 *
 * This is considered a low-level function; typically you can simply use
 * `filteredState()` instead, which takes an IWorkbenchState and returns
 * another, filtered one, without modifying the original one. It can also be
 * used in curried form.
 *
 * @param  pred  the filter predicate
 * @param  input the workbench configuration or state to transform, or an
 *               iterator that yields items from a workbench configuration
 */
export function filterState(
  pred: (item: ItemConfigType) => boolean,
  input: Config | IWorkbenchState | Iterator<ItemConfigType>
) {
  const iterator: Iterator<ItemConfigType> =
    ("next" in input && input.next !== undefined) ?
      input : itemsIn(input as any);
  let replacement: undefined | typeof REMOVE;

  while (true) {
    const { done, value } = iterator.next(replacement);
    if (done) {
      break;
    }
    replacement = pred(value) ? undefined : REMOVE;
  }
}

/**
 * Filters a workbench state object by calling a predicate with each
 * panel in the state object (but not containers) and removing it if the given
 * predicate returns false.
 *
 * @param  pred   the filter predicate
 * @param  state  the state object to filter
 * @return the filtered state object
 */
export function filteredPanels(
  pred: (item: ItemConfigType) => boolean
): WorkbenchStateTransformer;
export function filteredPanels(
  pred: (item: ItemConfigType) => boolean,
  state: IWorkbenchState
): IWorkbenchState;
export function filteredPanels(
  pred: (item: ItemConfigType) => boolean,
  state?: IWorkbenchState
): any {
  if (arguments.length === 1) {
    return (newState: IWorkbenchState) => filteredState(pred, newState);
  }

  if (state === undefined) {
    throw new Error("state must not be undefined");
  }

  const result: IWorkbenchState = cloneDeep(state);
  filterState(pred, panelsIn(result));
  return result;
}

/**
 * Filters a workbench state object by calling a predicate with each
 * configuration item (panel or container) and removing it if the given
 * predicate returns false.
 *
 * This function does not modify the original state object and returns a
 * deep copy instead. The function can also be used in curried form by omitting
 * the input.
 *
 * @param  pred   the filter predicate
 * @param  state  the state object to filter
 * @return the filtered state object
 */
export function filteredState(
  pred: (item: ItemConfigType) => boolean
): WorkbenchStateTransformer;
export function filteredState(
  pred: (item: ItemConfigType) => boolean,
  state: IWorkbenchState
): IWorkbenchState;
export function filteredState(
  pred: (item: ItemConfigType) => boolean,
  state?: IWorkbenchState
): any {
  if (arguments.length === 1) {
    return (newState: IWorkbenchState) => filteredState(pred, newState);
  }

  if (state === undefined) {
    throw new Error("state must not be undefined");
  }

  const result: IWorkbenchState = cloneDeep(state);
  filterState(pred, result);
  return result;
}

/**
 * Transforms the configuration of a workbench in-place by calling a function
 * with each configuration item (panel or container) and replacing the
 * configuration item with whatever the mapping function returns.
 *
 * This is considered a low-level function; typically you can simply use
 * `transformedState()` instead, which takes an IWorkbenchState and returns
 * another, transformed one, without modifying the original one. It can also be
 * used in curried form.
 *
 * @param  func  the mapper function
 * @param  input the workbench configuration or state to transform, or an
 *               iterator that yields items from a workbench configuration
 */
export function transformState(
  func: (item: ItemConfigType) => ItemConfigType,
  input: Config | IWorkbenchState | Iterator<ItemConfigType>
) {
  const iterator: Iterator<ItemConfigType> =
    ("next" in input && input.next !== undefined) ?
      input : itemsIn(input as any);
  let replacement: ItemConfigType | undefined;

  while (true) {
    const { done, value } = iterator.next(replacement);
    if (done) {
      break;
    }

    replacement = func(value);
    if (replacement === value) {
      replacement = undefined;         // no need to replace the item
    }
  }
}

/**
 * Transforms a workbench state object by calling a function with each
 * configuration item (panel or container) and replacing the
 * configuration item with whatever the mapping function returns.
 *
 * This function does not modify the original state object and returns a
 * deep copy instead. The function can also be used in curried form by omitting
 * the input.
 *
 * @param  func   the mapper function
 * @param  state  the state object to transform
 * @return the transformed state object
 */
export function transformedState(
  func: (item: ItemConfigType) => ItemConfigType
): WorkbenchStateTransformer;
export function transformedState(
  func: (item: ItemConfigType) => ItemConfigType,
  state: IWorkbenchState
): IWorkbenchState;
export function transformedState(
  func: (item: ItemConfigType) => ItemConfigType,
  state?: IWorkbenchState
): any {
  if (arguments.length === 1) {
    return (newState: IWorkbenchState) => transformedState(func, newState);
  }

  if (state === undefined) {
    throw new Error("state must not be undefined");
  }

  const result: IWorkbenchState = cloneDeep(state);
  transformState(func, result);
  return result;
}
