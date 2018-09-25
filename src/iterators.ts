import { Config, ContentItem, ItemConfigType } from "golden-layout";

import { WorkbenchState } from "./types";
import { Workbench } from "./workbench";

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
}

/**
 * Generic reverse depth-first iteration that iterates over a tree specified
 * using an object satisfying ITree<T>.
 */
function dfsReverseIterator<T>(tree: ITree<T>): Iterator<T> {
  const stack: Array<{ item: T, index: number }> = [];
  const root = tree.getRoot();
  let parentOfLastEntry: { item: T, index: number } | undefined;

  if (root) {
    stack.push({ index: 0, item: root });
  }

  return {
    next(received: T | undefined): IteratorResult<T> {
      if (received !== undefined) {
        if (tree.replaceChild !== undefined) {
          if (parentOfLastEntry) {
            tree.replaceChild(
              parentOfLastEntry.item, parentOfLastEntry.index - 1,
              received
            );
          } else {
            throw new Error("cannot yield item into generator before " +
                            "the generator is started or after it has " +
                            "ended");
          }
        } else {
          throw new Error("iteratee is immutable");
        }
      }

      while (stack.length > 0) {
        const entry = stack[stack.length - 1];
        const { item, index } = entry;
        const child = tree.getChild(item, index);

        if (child === undefined) {
          // All children traversed; yield the item itself and pop it
          stack.pop();
          parentOfLastEntry = stack.length > 0 ? stack[stack.length - 1] : undefined;
          return {
            done: stack.length === 0,
            value: item
          };
        } else {
          // Put the appropriate child on the stack
          entry.index++;
          stack.push({ index: 0, item: child });
        }
      }

      parentOfLastEntry = undefined;
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
 * Filters an iterator and returns only those items that match a given
 * condition.
 *
 * @param  iterator  the iterator to filter
 * @param  condition the condition to test
 * @return another iterator that returns only those items that match the given
 *         condition
 */
function filter<T>(iterator: Iterator<T>, condition: (item: T) => boolean): Iterator<T> {
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
function workbenchConfigurationAsTree(config: Config | WorkbenchState): ITree<ItemConfigType> {
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
  input: Config | WorkbenchState, options?: Partial<IIterationOptions>
): Iterator<ItemConfigType>;
export function itemsIn(
  input: Workbench | Config | WorkbenchState,
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
  input: Config | WorkbenchState, options?: Partial<IIterationOptions>
): Iterator<ItemConfigType>;
export function panelsIn(
  input: Workbench | Config | WorkbenchState,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem | ItemConfigType> {
  if (input instanceof Workbench) {
    return filter(
      itemsIn(input, options),
      item => item.isComponent
    );
  } else {
    return filter(
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
  input: Config | WorkbenchState, options?: Partial<IIterationOptions>
): Iterator<ItemConfigType>;
export function containersIn(
  input: Workbench | Config | WorkbenchState,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem | ItemConfigType> {
  if (input instanceof Workbench) {
    return filter(
      itemsIn(input, options),
      item => !item.isComponent
    );
  } else {
    return filter(
      itemsIn(input, options),
      item => item.type === "row" || item.type === "column" || item.type === "stack"
    );
  }
}
