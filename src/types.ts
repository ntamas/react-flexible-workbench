import * as GoldenLayout from "golden-layout";
import * as React from "react";

export type ComponentConstructor<TState> = (
  ((node: GoldenLayout.Container, state: TState) => void) |
  {
    new(node: GoldenLayout.Container, state: TState): {};
  }
);

export type Container = GoldenLayout.Container;
export type DragSource = any;
export type ItemConfigType = GoldenLayout.ItemConfigType;

// Borrowed from @types/react, needed by IContextDefinition
export type Validator<T> = (object: T, key: string, componentName: string, ...rest: any[]) => Error | null;

/**
 * Type specfiication for functions that can take the registered name of a
 * workbench component and a set of props, and then return a React node to
 * render as a fallback in place of the real component if the real component
 * cannot be created for some reason.
 */
export type FallbackHandler = (name: string, props: any) => React.ReactElement<any>;

/**
 * React higher-order component type specification.
 */
export type HigherOrderComponent<SProps, TProps> =
  (component: React.ComponentType<SProps>) => React.ComponentType<TProps>;

export interface IItemConfigurationOptions {
  eager: boolean;
  props: any;
  title: string | (() => string);
}

/**
 * Props that are injected into a React component that is placed as a panel
 * in a workbench.
 */
export interface IWorkbenchPanelProps {
  glContainer: GoldenLayout.Container;
  glEventHub: GoldenLayout.EventEmitter;
}

/**
 * Object that identifies a "place" in the workbench where a new item can be
 * dropped or placed.
 */
export interface IWorkbenchPlace {
  /**
   * The parent container of the place.
   */
  parent: GoldenLayout.ContentItem | undefined;

  /**
   * Index of the slot within the parent container. The slot may refer to a
   * place between two panels in a horizontal or vertical container, or to a
   * tab in a tabular container.
   */
  index?: number;

  /**
   * When the place refers to a part of a slot, this property specifies which
   * part of a slot the place refers to. Possible values are: left half
   * (`left`), right half (`right`), upper half (`top`), lower half (`bottom`),
   * tab bar of a panel (`header`) or the entire body of a panel (`body`).
   */
  segment?: "left" | "right" | "top" | "bottom" | "header" | "body";
}

/**
 * Interface specification for functions that can be used as an argument
 * to `traverseWorkbench()` and `Workbench.forEach()`. These functions take
 * the layout item (container or panel) being visited and must return true
 * if the traversal should *not* continue with the children of the item.
 * It may also return a function that will be invoked with each child of
 * the item and it must return true if the children should *not* be visited.
 *
 * (In case you wonder about the semantics of the return value of the
 * function: we want to support functions returning void and in these cases,
 * the traversal should continue for all items. Void is a falsy value.
 * Hence, for sake of consistency, all falsy values should mean that the
 * traversal should continue).
 */
export type ItemVisitor = (item: GoldenLayout.ContentItem) =>
  boolean | void | GoldenLayout.ContentItem[] |
  ((child: GoldenLayout.ContentItem) => boolean);

/**
 * Type specification for the state of the workbench.
 */
export type WorkbenchState = any;
