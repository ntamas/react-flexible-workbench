import {
  ComponentFactory, createHandlerWithFallback,
  EagerReactComponentHandler, LazyReactComponentHandler
} from "./handlers";
import {
  ComponentConstructor, FallbackHandler, HigherOrderComponent
} from "./types";
import {
  getDisplayName, isReactSFC, wrapInComponent
} from "./utils";

import * as GoldenLayout from "golden-layout";
import * as React from "react";

/**
 * Class that manages an association between string identifiers and the
 * corresponding React components or component factory functions.
 *
 * This is used by the workbench so that it can refer to components with
 * symbolic names (strings) instead of serializing the components themselves
 * in state objects.
 */
export class ComponentRegistry {

  private _data: {
    [key: string]: {
      component?: React.ComponentType<any>;
      factory?: ComponentConstructor<any>;
    }
  };

  /**
   * Fallback component or function that is used to resolve errors when the
   * user tries to create a component that is not registered in the registry.
   * The function will be called with the registered name of the component that
   * the user tried to create and its props, and it must return a React node
   * to render as fallback.
   */
  public fallback: FallbackHandler | undefined;

  /**
   * Constructor. Creates a registry with the default registrations that are
   * needed for Golden-Layout to work.
   *
   * @param  fallback  fallback component handler that creates a component
   *         when the original component handler fails
   */
  constructor() {
    this._data = {
      "lm-react-component": {
        factory: createHandlerWithFallback(
          EagerReactComponentHandler, this._handleComponentCreationFailure
        )
      },
      "lm-react-lazy-component": {
        factory: createHandlerWithFallback(
          LazyReactComponentHandler, this._handleComponentCreationFailure
        )
      }
    };
  }

  /**
   * Returns the React component or factory function corresponding to the
   * given name in the registry.
   *
   * @param  name  the name whose corresponding React component or factory
   *         function is being searched
   * @return the factory function or React component that was registered with
   *         the given name, or undefined if the given name does not correspond
   *         to a factory function or React component
   */
  public find(name: string): ComponentConstructor<any> | React.ComponentType<any> | undefined {
    const value = this._data[name];
    if (value === undefined) {
      return undefined;
    } else if (value.factory !== undefined) {
      return value.factory;
    } else if (value.component !== undefined) {
      return (value.component as any).wrappedComponent || value.component;
    } else {
      return undefined;
    }
  }

  /**
   * Returns the registered name of the given function or React component in
   * the registry.
   *
   * @param  factory  the factory function or React component whose registered
   *         name is to be retrieved
   * @return the name corresponding to the input or <code>undefined</code> if
   *         there is no such function or React component
   */
  public findRegisteredNameFor(
    factory: ComponentConstructor<any> | React.ComponentType<any>
  ): string | undefined {
    return Object.keys(this._data).find(key => {
      const value = this._data[key];
      return value.component === factory || value.factory === factory ||
        (value.component !== undefined && (value.component as any).wrappedComponent === factory);
    });
  }

  /**
   * Returns the registered factory function for the given name.
   *
   * @param  name  the name whose corresponding factory function is being
   *         searched
   * @return the factory function that was registered with the given name, or
   *         undefined if the given name does not correspond to a factory
   *         function
   */
  public findRegisteredFactoryFor(name: string): ComponentConstructor<any> | undefined {
    const value = this._data[name];
    if (value !== undefined && value.factory !== undefined) {
      return value.factory;
    } else {
      return undefined;
    }
  }

  /**
   * Returns the registered React component for the given name.
   *
   * @param  name  the name whose corresponding React component is being
   *         searched
   * @return the React component that was registered with the given name, or
   *         undefined if the given name does not correspond to a React
   *         component
   */
  public findRegisteredReactComponentFor(name: string): React.ComponentType<any> | undefined {
    const value = this._data[name];
    if (value !== undefined && value.component !== undefined) {
      return (value.component as any).wrappedComponent || value.component;
    } else {
      return undefined;
    }
  }

  /**
   * Returns whether a plain component factory or a React component is registered
   * with the given name.
   */
  public isRegistered(name: string): boolean {
    return this._data[name] !== undefined;
  }

  /**
   * Returns whether a React component is registered with the given name.
   */
  public isRegisteredAsReact(name: string): boolean {
    return this.isRegistered(name) && this._data[name].component !== undefined;
  }

  /**
   * Registers a new plain component factory in the registry with the given
   * name.
   *
   * Chances are that you need this function only if you are not using React.
   * For React components, use <code>registerComponent()</code> instead.
   *
   * In case you wonder: the two functions cannot be unified because React
   * functional components cannot be distinguished from factory functions.
   *
   * @param  name     the name of the factory to register. Can be omitted.
   * @param  factory  the factory function to register. It will be invoked with
   *                  the layout container and the state object of the component
   *                  and must update the contents of the container.
   * @return the name that the factory function was registered for
   */
  public register<TState>(name: string, factory?: undefined):
    (newFactory: ComponentConstructor<TState>) => void;
  public register<TState>(factory: ComponentConstructor<TState>): string;
  public register<TState>(name: string, factory: ComponentConstructor<TState>): string;
  public register<TState>(nameOrFactory: string | ComponentConstructor<TState>,
                          maybeFactory?: ComponentConstructor<TState>): any {
    let name: string;
    let factory: ComponentConstructor<TState>;

    // Check whether we have a name for the component.
    if (typeof nameOrFactory === "string") {
      name = nameOrFactory;
      if (maybeFactory === undefined) {
        return (newFactory: ComponentConstructor<TState>) => this.register(name, newFactory);
      } else {
        factory = maybeFactory;
      }
    } else {
      factory = nameOrFactory;
      name = factory.name;
      if (maybeFactory !== undefined) {
        throw new Error("the second argument cannot be a factory function if " +
                        "the first one is not a string");
      }
      if (name === undefined) {
        throw new Error("cannot register unnamed functions without specifying " +
                        "a name explicitly");
      }
    }

    // Okay, at this point we have a sensible value for both 'name' and
    // 'factory'.

    // If 'factory' is a bound or arrow function, it cannot be used as a
    // constructor and golden-layout will freak out. We fix it by wrapping it
    // in another function that is not bound.
    if (!factory.hasOwnProperty("prototype")) {
      const oldFactory = factory as any;
      factory = function(node: GoldenLayout.Container, state: TState): void {
        oldFactory(node, state);
        return this;
      };
    }

    this._data[name] = { factory };

    return name;
  }

  /**
   * Registers a new React component for the workbench with the given name.
   *
   * @param  name  the name of the component that the React component will be
   *               known as. This can be omitted; defaults to the actual name
   *               of the component.
   * @param  component  the React component class or stateless functional
   *                    component to register. Its props will be set to the
   *                    props specified in the <code>golden-layout</code>
   *                    configuration object.
   * @return the name that the component was registered for
   */
  public registerComponent<TProps>(name: string, component?: undefined):
    (newComponent: React.ComponentType<TProps>) => string;
  public registerComponent<TProps>(component: React.ComponentType<TProps>): string;
  public registerComponent<TProps>(name: string, component: React.ComponentType<TProps>): string;
  public registerComponent<TProps>(
    nameOrComponent: string | React.ComponentType<TProps>,
    maybeComponent?: React.ComponentType<TProps>
  ): any {
    let name: string;
    let component: React.ComponentType<TProps>;

    // Check whether we have a name for the component.
    if (typeof nameOrComponent === "string") {
      name = nameOrComponent;
      if (maybeComponent === undefined) {
        return (newComponent: React.ComponentType<TProps>) =>
          this.registerComponent(name, newComponent);
      } else {
        component = maybeComponent;
      }
    } else {
      component = nameOrComponent;
      name = getDisplayName(component) || "";
      if (maybeComponent !== undefined) {
        throw new Error("the second argument cannot be a component if " +
                        "the first one is not a string");
      }
      if (name.length === 0) {
        throw new Error("cannot register unnamed components without specifying " +
                        "a name explicitly");
      }
    }

    if (isReactSFC(component)) {
      // Component is a stateless functional component. These are currently
      // not allowed in golden-layout as of 1.5.9. I have already submitted a
      // pull request to address this issue:
      //
      // https://github.com/deepstreamIO/golden-layout/pull/334
      //
      // Until the PR is resolved, we need to wrap the component in a React
      // component class.
      component = wrapInComponent(component as any);
    }

    // Okay, at this point we have a sensible value for both 'name' and
    // 'component'.

    this._data[name] = { component };

    return name;
  }

  /**
   * Prepares a GoldenLayout layout object such that it knows about all the
   * components registered in this registry.
   *
   * @param  layout the layout object to prepare
   * @param  hoc    an optional higher-order component that will be called on
   *         all the React components being registered; it can be used to
   *         provide context or default props to all registered components
   */
  public prepareLayout(layout: GoldenLayout, hoc?: HigherOrderComponent<any, any>): void {
    // HACK: Get rid of the default React component handler from GoldenLayout
    (layout as any)._components = {};

    // Register all the components in the layout
    Object.keys(this._data).forEach(key => {
      let { component } = this._data[key];
      const { factory } = this._data[key];
      if (component !== undefined && hoc !== undefined) {
        component = hoc(component);
      }
      layout.registerComponent(key, component || factory);
    });
  }

  /**
   * Handles the case when a component in the workbench cannot be created
   * for any reason (for instance, missing component registration).
   */
  private _handleComponentCreationFailure = (componentName: string): ComponentFactory | undefined => {
    const { fallback } = this;
    if (fallback) {
      return props => fallback(componentName, props);
    }
  }

}
