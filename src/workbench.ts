import * as GoldenLayout from "golden-layout";
import * as JQuery from "jquery";
import { pick } from "lodash";
import * as React from "react";

import { Builder } from "./builder";
import { ComponentConstructor, DragSource } from "./types";
import { getDisplayName } from "./utils";

// Require golden-layout CSS and theme files so they get included in the bundle
require("golden-layout/src/css/goldenlayout-base.css");
require("golden-layout/src/css/goldenlayout-light-theme.css");

// Require javascript-detect-element-resize so it gets included in the bundle
const foo = require("javascript-detect-element-resize");

export class Workbench {

  public static Builder = Builder;

  private _config: GoldenLayout.Config | undefined;
  private _configDefaults: Partial<GoldenLayout.Config>;
  private _layout: GoldenLayout | undefined;
  private _registry: {
    [key: string]: {
      component?: React.ComponentType<any>;
      factory?: ComponentConstructor<any>;
    }
  };

  /**
   * Constructor. Creates an empty workbench.
   */
  constructor() {
    this._registry = {};
    this._configDefaults = {
      // Popouts are not nice so we take an opinionated override here
      settings: {
        showPopoutIcon: false
      }
    };
  }

  /**
   * Configures the workbench with the given configuration object. See the
   * documentation of <code>golden-layout</code> for more details.
   *
   * @param {GoldenLayout.Config} config  the configuration object
   */
  public configure(config: GoldenLayout.Config): void {
    this._config = config;
  }

  /**
   * Returns the registered name of the given function or React component in
   * the workbench.
   *
   * @param  factory  the factory function or React component whose registered
   *         name is to be retrieved
   * @return the name corresponding to the input or <code>undefined</code> if
   *         there is no such function or React component
   */
  public findRegisteredNameFor(
    factory: ComponentConstructor<any> | React.ComponentType<any>
  ): string | undefined {
    return Object.keys(this._registry).find(key => {
      const value = this._registry[key];
      return value.component === factory || value.factory === factory;
    });
  }

  /**
   * Returns a JSON-friendly JavaScript object that stores the current state of
   * the workbench.
   *
   * Note that the state object returned here is not the full state of the
   * workbench, only the part that encodes where the panels are and how they
   * are sized relative to each other.
   */
  public getState(): any {
    return pick(this._getLayout().toConfig(), ["content", "isClosable"]);
  }

  /**
   * Returns whether a plain component factory or a React component is registered
   * with the given name.
   */
  public isRegistered(name: string): boolean {
    return this._registry[name] !== undefined;
  }

  /**
   * Returns whether a React component is registered with the given name.
   */
  public isRegisteredAsReact(name: string): boolean {
    return this.isRegistered(name) && this._registry[name].component !== undefined;
  }

  /**
   * Registers a new plain component factory for the workbench with the given
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
      const oldFactory = factory;
      factory = function(node: GoldenLayout.Container, state: TState): void {
        oldFactory(node, state);
        return this;
      };
    }

    this._registry[name] = { factory };

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

    // Okay, at this point we have a sensible value for both 'name' and
    // 'component'.

    this._registry[name] = { component };

    return name;
  }

  /**
   * Registers a new item to be used as a drag source in the workbench. The
   * item can then be dragged to the workbench to create a new panel.
   *
   * @param  element  the element to register in the workbench as a drag source
   * @param  config   the item that will be created when the item is dragged to
   *                  the workbench
   * @return an opaque object that identifies the drag source and that can be
   *         passed to <code>removeDragSource()</code> later on to remove it
   */
  public createDragSource(element: HTMLElement | JQuery,
                          itemConfiguration: GoldenLayout.ItemConfigType): DragSource {
    return this._getLayout().createDragSource(element, itemConfiguration);
  }

  /**
   * Removes the given drag source from the workbench so it cannot be used to
   * drag new items into the workbench any more.
   */
  public removeDragSource(dragSource: DragSource): void {
    const layout = this._getLayout();
    if (typeof (layout as any).removeDragSource === "function") {
      // This feature is not yet released in golden-layout but we have a
      // patched version so use this if we could
      return (this._getLayout() as any).removeDragSource(dragSource);
    } else {
      // This is a hack for older versions of golden-layout that do not support
      // removeDragSource()
      if (dragSource._dragListener !== null) {
        dragSource._dragListener.destroy();
        dragSource._dragListener = null;
      }
      (layout as any)._dragSources.splice(
        (layout as any)._dragSources.indexOf(dragSource), 1
      );
    }
  }

  /**
   * Renders the workbench in the given node of the page.
   *
   * @param  node  the node to render the workbench into; omitting it means that
   *         the workbench must fill the entire page.
   */
  public render(node?: Element | HTMLElement | JQuery | string): void {
    const resolvedNode = node !== undefined ? this._resolve(node) : undefined;

    if (this._config === undefined) {
      throw new Error("Workbench is not configured yet");
    }

    // Create the final configuration object by merging the user-defined
    // config over our defaults
    const config: GoldenLayout.Config = Object.assign(
      {}, this._configDefaults, this._config
    );

    // Create the golden-layout object and initialize it
    const layout: GoldenLayout = new GoldenLayout(config, resolvedNode);
    Object.keys(this._registry).forEach((key: string) => {
      const { component, factory } = this._registry[key];
      layout.registerComponent(key, component || factory);
    });
    layout.init();

    // Attach an event handler for resize events if the given node is not the
    // document body
    if (resolvedNode !== undefined && resolvedNode !== document.body) {
      window.addResizeListener(resolvedNode, () => {
        if (layout && layout.container && layout.container.width) {
          layout.updateSize();
        }
      });
    }

    // Store the created layout object
    this._layout = layout;
  }

  /**
   * Returns the <code>golden-layout</code> object associated to the workbench
   * if it has been created already yet, or throws an exception if the workbench
   * is not ready.
   */
  private _getLayout(): GoldenLayout {
    if (!this._layout) {
      throw new Error("workbench has not been rendered yet");
    }
    return this._layout;
  }

  private _resolve(node: Element | HTMLElement | JQuery | string): Element | HTMLElement | JQuery {
    if (typeof node === "string") {
      const result = document.getElementById(node && node.charAt(0) === "#" ? node.substr(1) : node);
      if (result !== null) {
        return result;
      } else {
        throw new Error("Cannot find DOM node: " + node);
      }
    } else {
      return node;
    }
  }

}
