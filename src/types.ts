import * as GoldenLayout from "golden-layout";

export type ComponentConstructor<TState> =
  (node: GoldenLayout.Container, state: TState) => void;

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
 * Type specification for the state of the workbench.
 */
export type WorkbenchState = any;
