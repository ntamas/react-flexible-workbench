import * as GoldenLayout from "golden-layout";

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
 * Interface for objects that describe the context that has to be provided to
 * every React component in the workbench.
 */
export interface IContextDefinition<T> {
  childContextTypes: {
    [key: string]: Validator<any>;
  };

  getChildContext(): T;
}

/**
 * Interface for objects that are either context definitions themselves, or
 * can provide a context definition for a React component that is about to be
 * displayed in the workbench.
 */
export type ContextProvider<T> =
  IContextDefinition<T> |
  ((component: React.ComponentType<any>) => IContextDefinition<T> | undefined);

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
