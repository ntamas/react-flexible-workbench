import { ContentItem } from "golden-layout";

import { Workbench } from "./workbench";

/**
 * String constants defining the known iteration orders.
 */
export type IterationOrder = "dfsReverse";

export interface IIterationOptions {
  order: IterationOrder;
}

/**
 * Returns an iterator that will iterate over the content items of the given
 * workbench in reverse DFS order (deepest panels first).
 */
function dfsReverseIterator(workbench: Workbench): Iterator<ContentItem> {
  const stack: Array<{
    item: ContentItem,
    index: 0
  }> = [];

  if (workbench.layout) {
    stack.push({ item: workbench.layout.root, index: 0 });
  }

  return {
    next(): IteratorResult<ContentItem> {
      while (stack.length > 0) {
        const entry = stack[stack.length - 1];
        const { item, index } = entry;

        if (index >= item.contentItems.length) {
          // All children traversed; yield the item itself and pop it
          stack.pop();
          return {
            done: stack.length === 0,
            value: item
          };
        } else {
          // Put the appropriate child on the stack
          entry.index++;
          stack.push({
            index: 0,
            item: item.contentItems[index],
          });
        }
      }

      return { done: true } as any;
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
  return {
    next(): IteratorResult<T> {
      while (true) {
        const entry = iterator.next();
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
          }
        }
      }
    }
  };
}

/**
 * Iterates over the content items of the workbench according to some iteration
 * order.
 *
 * Both panels (leaf nodes) and containers (rows, columns and stacks) will be
 * returned by the iterator. If you need the panels only, use `panelsIn()`.
 * If you need the containers only, use `containersIn()`.
 *
 * @param  workbench the workbench whose content items are to be iterated over
 * @param  options   additional options that influence the iterator behaviour
 * @return the iterator
 */
export function contentItemsIn(
  workbench: Workbench,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem> {
  const effectiveOptions: IIterationOptions = {
    order: "dfsReverse",
    ...options
  };

  switch (effectiveOptions.order) {
    case "dfsReverse":
      return dfsReverseIterator(workbench);

    default:
      throw new Error("unknown iteration order: " + effectiveOptions.order);
  }
}

/**
 * Iterates over the panels of the workbench according to some iteration order.
 *
 * Only panels will be returned by this iterator; containers will be ignored.
 *
 * @param  workbench the workbench whose panels are to be iterated over
 * @param  options   additional options that influence the iterator behaviour
 * @return the iterator
 */
export function panelsIn(
  workbench: Workbench,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem> {
  return filter(
    contentItemsIn(workbench, options),
    item => item.type === "component"
  );
}

/**
 * Iterates over the containers of the workbench according to some iteration
 * order.
 *
 * Only containers will be returned by this iterator; panels will be ignored.
 *
 * @param  workbench the workbench whose containers are to be iterated over
 * @param  options   additional options that influence the iterator behaviour
 * @return the iterator
 */
export function containersIn(
  workbench: Workbench,
  options?: Partial<IIterationOptions>
): Iterator<ContentItem> {
  return filter(
    contentItemsIn(workbench, options),
    item => item.type !== "component"
  );
}
