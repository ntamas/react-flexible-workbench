import * as GoldenLayout from "golden-layout";
import * as JQuery from "jquery";
import isArray from "lodash-es/isArray";
import isFunction from "lodash-es/isFunction";
import reject from "lodash-es/reject";
import * as React from "react";

import { ItemVisitor, IWorkbenchPlace } from "./types";

const _eventNameMapping: { [key: string]: string } = {
  activecontentitemchanged: "activeContentItemChanged",
  columncreated: "columnCreated",
  componentcreated: "componentCreated",
  itemcreated: "itemCreated",
  itemdestroyed: "itemDestroyed",
  rowcreated: "rowCreated",
  selectionchanged: "selectionChanged",
  stackcreated: "stackCreated",
  statechanged: "stateChanged",
  tabcreated: "tabCreated",
  titlechanged: "titleChanged",
  windowclosed: "windowClosed",
  windowopened: "windowOpened"
};

/**
 * Capitalizes the all-lowercase variants of events officially supported by
 * `golden-layout`.
 */
export function capitalizeEventName(eventName: string | symbol): string | symbol {
  if (typeof eventName === "symbol") {
    return eventName;
  } else {
    return _eventNameMapping[eventName.toLowerCase()] || eventName;
  }
}
/**
 * Extracts the component IDs from the given content item if it represents
 * a component in a layout.
 */
export function extractIdsFromContentItem(item: GoldenLayout.ContentItem): string[] {
  const maybeIds = item.type === "component" && item.config ? item.config.id : [];
  if (maybeIds !== undefined) {
    return isArray(maybeIds) ? maybeIds : [maybeIds];
  } else {
    return [];
  }
}

/**
 * Extracts the size of the component from the given content item.
 *
 * @param {GoldenLayout.ContentItem} item  the item to extract the size from
 * @return the size of the item, given as an array of length 2 (width and height)
 */
export function extractSizeFromContentItem(item: GoldenLayout.ContentItem): [number, number] {
  if (item.isComponent) {
    const container = (item as any).container;
    return container ? [container.width, container.height] : [0, 0];
  } else {
    // Golden-Layout's typing is incorrect; it says that item.element is a
    // GoldenLayout.Container but in fact it is a JQuery object.
    const element: JQuery<HTMLElement> = (item.element as any);
    return element ? [element.width() || 0, element.height() || 0] : [0, 0];
  }
}

/**
 * Finds the largest visible panel in the given layout.
 */
export function findLargestVisiblePanel(tree: GoldenLayout): GoldenLayout.ContentItem | undefined {
  let result: GoldenLayout.ContentItem | undefined;
  let maxArea: number = 0;

  const visitor: ItemVisitor = (item: GoldenLayout.ContentItem) => {
    if (item.isInitialised && item.isComponent) {
      const [ width, height ] = extractSizeFromContentItem(item);
      if (width * height > maxArea) {
        maxArea = width * height;
        result = item;
      }
    }
  };

  traverseWorkbench(tree, onlyVisible(visitor));

  return result;
}

export function getDisplayName(component: React.ReactType): string | undefined {
  return (typeof component === "string") ? (
    component.length > 0 ? component : undefined
  ) : (
    component.displayName || component.name || undefined
  );
}

export function isElementClassEqualTo<P>(
  cls: React.ComponentClass<P>, element: React.ReactElement<any> | React.ReactText | undefined
): element is React.ReactElement<P> {
  if (element === undefined ||
      typeof element === "string" || typeof element === "number") {
    return false;
  }
  if (element.hasOwnProperty("props") &&
      element.hasOwnProperty("type") && element.type === cls) {
      return true;
  } else {
    return false;
  }
}

export function isReactSFC(obj: any): boolean {
  if (obj === undefined || typeof obj !== "function") {
    return false;
  }
  return !(obj.prototype instanceof React.Component);
}

/**
 * Takes an item visitor function and returns another one that will traverse
 * only the part of the workbench that is currently visible (and not hidden
 * in unselected panels of a content stack).
 *
 * The converted function will also skip any non-initialized parts of the
 * workbench.
 *
 * @param  {ItemVisitor} func  the visitor function to convert
 * @return {ItemVisitor} the converted function
 */
export function onlyVisible(func: ItemVisitor): ItemVisitor {
  return (item: GoldenLayout.ContentItem) => {
    if (!item.isInitialised) {
      return true;
    } else if (item.isStack) {
      const result = func(item);
      const selectedChild = item.getActiveContentItem();
      if (selectedChild !== undefined) {
        if (!result) {
          // Continue unconditionally
          return [selectedChild];
        } else if (isFunction(result)) {
          // Test whether the selected content item passes the filter
          return result(selectedChild) ? [selectedChild] : [];
        } else if (isArray(result)) {
          // Test whether the selected content item matches the ones returned
          // by the visitor
          return result.includes(selectedChild) ? [selectedChild] : [];
        } else {
          // Stop unconditionally
          return true;
        }
      } else {
        return true;
      }
    } else {
      return func(item);
    }
  };
}

/**
 * Proposes a location for a new item in the layout.
 *
 * The function will find the largest visible panel in the layout and then
 * it will attempt to split the panel in half.
 */
export function proposePlaceForNewItemInLayout(tree: GoldenLayout): IWorkbenchPlace {
  const largestPanel = findLargestVisiblePanel(tree);
  if (largestPanel === undefined) {
    // There are no panels yet, so just add the new panel to the root
    return {
      parent: tree.root
    };
  } else {
    const parent = largestPanel.parent;
    if (parent === undefined) {
      // The largest panel has no parent. This should not really happen
      // under normal conditions, but anyway, let's just add new the panel
      // to the root as a new child.
      return {
        parent: tree.root
      };
    } else if (parent.isStack) {
      // The parent of the largest panel is a stack, which is the typical
      // case.
      const size = extractSizeFromContentItem(parent);
      let segment: "body" | "header" | "right" | "bottom";

      if (!parent.contentItems || parent.contentItems.length === 0) {
        // Stack is empty, just add the item to its body
        segment = "body";
      } else if ((size[0] < 100 && size[1] < 100) &&
                 (!tree.config.settings || tree.config.settings.hasHeaders)) {
        // Stack is too small to split, just add another tab if the layout
        // currently supports headers.
        segment = "header";
      } else if (size[0] < size[1]) {
        // Stack is taller than wider, so split it horizontally
        segment = "bottom";
      } else {
        // Stack is wider than taller, so split it vertically
        segment = "right";
      }

      return {
        parent, segment
      };
    } else {
      // In normal conditions, we should not reach this branch because
      // row and column containers always contain a stack within them.
      // However, if we still reach it somehow, let's just specify that
      // we want to add a new child at the given index
      return {
        index: parent.contentItems.indexOf(largestPanel),
        parent
      };
    }
  }
}

/**
 * Calls the given item visitor function for each content item in the
 * given layout, pruning branches where the visitor function tells the
 * traversal process to stop.
 *
 * @param {GoldenLayout} tree  the tree to traverse
 * @param {ItemVisitor}  func  the visitor function to call on each visited item
 */
export function traverseWorkbench(tree: GoldenLayout, func: ItemVisitor): void {
  const queue: GoldenLayout.ContentItem[] = [tree.root];
  while (queue.length > 0) {
    const node = queue.pop();
    if (node !== null && node !== undefined) {
      const shouldStop = func(node);
      const children = node.hasOwnProperty("contentItems") ? node.contentItems : [];
      if (!shouldStop) {
        // Continue unconditionally
        queue.push(...children);
      } else if (isFunction(shouldStop)) {
        // Filter the children
        queue.push(...reject(children, shouldStop as any));
      } else if (isArray(shouldStop)) {
        // Visit only the given children
        queue.push(...shouldStop);
      }
    }
  }
}

export interface IWrappedComponent<T> {
  wrappedComponent: React.ComponentType<T>;
}

/**
 * Function that takes a React stateless functional component and wraps it in
 * an equivalent React stateful component class to ensure that it is handled
 * correctly by `react-flexible-workbench`.
 *
 * @param  {React.SFC<T>} func  the stateless functional component to wrap
 * @return {WrappedSFC<T>} the wrapped React component
 */
export function wrapInComponent<T>(func: React.SFC<T>): React.ComponentClass<T> & IWrappedComponent<T> {
  const result: React.ComponentClass<T> & IWrappedComponent<T> =
    class extends React.Component<T, {}> {
      public static wrappedComponent = func;

      public render() {
        return func(this.props, this.context);
      }
    };
  result.displayName = `wrapInComponent(${getDisplayName(func)})`;
  return result;
}
