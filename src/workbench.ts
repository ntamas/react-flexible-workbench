import { EventEmitter, ListenerFn } from "eventemitter3";
import * as GoldenLayout from "golden-layout";
import * as JQuery from "jquery";
import isFunction from "lodash-es/isFunction";
import merge from "lodash-es/merge";
import pick from "lodash-es/pick";
import * as React from "react";

import { Environment, IEnvironmentMethods } from "./environment";
import {
  ComponentFactory, createHandlerWithFallback,
  EagerReactComponentHandler, LazyReactComponentHandler
} from "./handlers";
import {
  ComponentConstructor, DragSource, FallbackHandler, HigherOrderComponent,
  IItemConfigurationOptions, ItemConfigType, ItemVisitor, IWorkbenchPlace,
  WorkbenchState
} from "./types";
import {
  capitalizeEventName, getDisplayName, isReactSFC, onlyVisible,
  proposePlaceForNewItemInLayout, traverseWorkbench, wrapInComponent
} from "./utils";

// Require golden-layout CSS and theme files so they get included in the bundle
require("golden-layout/src/css/goldenlayout-base.css");
require("golden-layout/src/css/goldenlayout-light-theme.css");

// Require our own CSS files as well
require("./workbench.css");

// Require javascript-detect-element-resize so it gets included in the bundle
require("javascript-detect-element-resize");

export class Workbench extends EventEmitter {

  private _blockedEvents: { [key: string]: number };
  private _config: GoldenLayout.Config | undefined;
  private _configDefaults: Partial<GoldenLayout.Config>;
  private _domNode: Element | undefined;
  private _layout: GoldenLayout | undefined;
  private _nextUnblockId: number;
  private _registry: {
    [key: string]: {
      component?: React.ComponentType<any>;
      factory?: ComponentConstructor<any>;
    }
  };

  /**
   * The environment that the workbench lives in. Methods of this object are
   * used to communicate with the application that hosts the workbench.
   */
  public environment: IEnvironmentMethods = Environment.browser;

  /**
   * Fallback component or function that is used to resolve errors when the
   * user tries to create a component that is not registered in the workbench.
   * The function will be called with the registered name of the component that
   * the user tried to create and its props, and it must return a React node
   * to render as fallback.
   */
  public fallback: FallbackHandler | undefined;

  /**
   * An optional React higher-order component that will be called with every
   * React component that is being registered in the workbench. You can use this
   * in conjunction with HOC libraries (e.g., `recompose`) to provide context
   * for React components or to wrap them in another component.
   *
   * This feature replaces the `contextProvider` property in previous versions
   * of `react-flexible-workbench`; you can use the `withContext()` HOC from
   * `recompose` to achieve the same functionality.
   *
   * Note that changing this property when the workbench is already rendered
   * will not affect the workbench.
   */
  public hoc: HigherOrderComponent<any, any> | undefined;

  /**
   * Constructor. Creates an empty workbench.
   */
  constructor() {
    super();

    this._blockedEvents = {};
    this._nextUnblockId = 1;

    this._registry = {
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
    this._configDefaults = {
      // Popouts are not nice so we take an opinionated override here
      settings: {
        showPopoutIcon: false
      }
    };
  }

  /**
   * Alias to the `addListener()` method to allow the workbench object to be
   * used with `react-event-listener` or other classes that expect a DOM-like
   * API.
   *
   * DOM event APIs typically use all-lowercase event names; however, the
   * workbench uses mixed-case event names (e.g., `stateChanged`). Therefore,
   * this method will map all-lowercase event names to their correctly capitalized
   * versions for all events that are officially supported by `golden-layout`
   */
  public addEventListener(eventName: string | symbol, listener: ListenerFn): void {
    this.addListener(capitalizeEventName(eventName), listener);
  }

  /**
   * Adds a new item to the workbench programmatically.
   *
   * @param  nameOrComponent  the name of the component constructor or the
   *                          React component
   * @param  options  additional options that can be used to tweak the
   *                  configuration object
   */
  public addNewItem(
    nameOrComponent: string | React.ComponentType<any>,
    options?: Partial<IItemConfigurationOptions>
  ): void {
    const config = this.createItemConfigurationFor(nameOrComponent, options);
    return this.addNewItemWithConfiguration(config);
  }

  /**
   * Adds a new item to the workbench, given a configuration object that
   * defines how the item should be added.
   *
   * This is a low-level function; you probably need `addNewItem()` instead.
   *
   * @param  config  the item configuration object
   */
  public addNewItemWithConfiguration(config: GoldenLayout.ItemConfigType): void {
    if (this.layout === undefined) {
      throw new Error("Cannot add new items to a workbench when it is " +
                      "not mounted");
    }

    const { parent, index, segment } = this._proposePlaceForNewItem();
    if (parent === undefined) {
      throw new Error("No place was proposed for a new item in the workbench; " +
                      "this is most likely a bug");
    }

    if (segment !== undefined) {
      // We are using a private API here but this is still the best way
      // of achieving what we want while messing around with private
      // APIs as little as possible
      const contentItem = (this.layout as any)._$normalizeContentItem(
        { ...config }
      );
      (parent as any)._dropSegment = segment;
      (parent as any)._$onDrop(contentItem);
    } else if (index !== undefined) {
      parent.addChild(config, index + 1);
    } else {
      parent.addChild(config);
    }
  }

  /**
   * Configures the workbench with the given configuration object. See the
   * documentation of <code>golden-layout</code> for more details.
   *
   * This function may be called multiple times. Subsequent calls will merge
   * the new configuration values into the ones that were previously applied.
   *
   * @param {GoldenLayout.Config} config  the configuration object
   */
  public configure(config: GoldenLayout.Config): void {
    this._config = merge({}, this._config, config);
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
   * Creates a new item configuration object for the given registered component
   * constructor name or React component.
   *
   * @param  nameOrComponent  the name of the component constructor or the
   *                          React component
   * @param  options  additional options that can be used to tweak the
   *                  configuration object
   */
  public createItemConfigurationFor(
    nameOrComponent: string | React.ComponentType<any>,
    options?: Partial<IItemConfigurationOptions>
  ): ItemConfigType {
    const name = this.ensureComponentIsRegistered(nameOrComponent);
    const effectiveOptions = Object.assign({
      eager: false,
      props: {},
      title: ""
    }, options);
    let result: ItemConfigType;
    const { eager, props, title } = effectiveOptions;

    if (this.isRegisteredAsReact(name)) {
      // TODO: handle eager
      result = {
        component: name,
        props: Object.assign({}, props),
        type: "react-component"
      };

      if (!eager) {
        // React component needs to be lazy, i.e. it needs to be unmounted
        // when it is hidden. This will be handled with a special
        // golden-layout handler class.
        result.type = "component";
        (result as any).componentName = "lm-react-lazy-component";
      }
    } else {
      result = {
        componentName: name,
        type: "component"
      };
    }

    result.title = isFunction(title) ? title() : title;

    return result;
  }

  /**
   * Destroys the workbench and removes it from the DOM.
   */
  public destroy(): void {
    this.detach();
  }

  /**
   * Detaches the workbench and removes it from the DOM, leaving the
   * possibility open to re-mount it later.
   */
  public detach(): void {
    this._setLayout(undefined);
    this._domNode = undefined;
  }

  /**
   * Ensures that the given component name or React component is registered
   * in the workbench.
   *
   * When the input argument is a React component and it was not registered yet
   * in the workbench, registers it under the display name of the component.
   *
   * @param  nameOrComponent  the name of the component constructor or the React
   *                          component to check
   * @return the name corresponding to the input argument
   * @throws Error  if the input argument is a component constructor name and
   *                it has not been registered yet
   */
  public ensureComponentIsRegistered(nameOrComponent: string | React.ComponentType<any>): string {
    let name;

    if (typeof nameOrComponent === "string") {
      name = nameOrComponent;
    } else {
      name = this.findRegisteredNameFor(nameOrComponent);
    }

    if (name === undefined) {
      if (typeof nameOrComponent === "string") {
        throw new Error("component is not registered in workbench yet");
      } else {
        name = this.registerComponent(nameOrComponent);
      }
    }

    return name;
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
      return value.component === factory || value.factory === factory ||
        (value.component !== undefined && (value.component as any).wrappedComponent === factory);
    });
  }

  /**
   * Calls the given function for each container and panel in the workbench,
   * in DFS order.
   */
  public forEach(func: ItemVisitor): void {
    if (this.isRendered) {
      traverseWorkbench(this._getLayout(), func);
    }
  }

  /**
   * Calls the given function for each *visible* container and panel in the
   * workbench, in DFS order. Panels that are hidden in a stack will not be
   * visited.
   */
  public forEachVisible(func: ItemVisitor): void {
    if (this.isRendered) {
      traverseWorkbench(this._getLayout(), onlyVisible(func));
    }
  }

  /**
   * Returns the raw Golden-Layout object behind this workbench.
   */
  public get layout(): GoldenLayout | undefined {
    return this._layout;
  }

  /**
   * Returns a serialized representation of the current state of the workbench.
   *
   * Note that the state object returned here is not the full state of the
   * workbench, only the part that encodes where the panels are and how they
   * are sized relative to each other.
   */
  public getState(): WorkbenchState {
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
   * Returns whether the workbench is currently attached to a DOM node.
   */
  public get isRendered(): boolean {
    return this._layout !== undefined;
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
      const oldFactory = factory as any;
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
      if (isReactSFC(component)) {
        // Component is a stateless functional component. These are currently
        // not allowed in golden-layout as of 1.5.9. I have already submitted a
        // pull request to address this issue:
        //
        // https://github.com/deepstreamIO/golden-layout/pull/334
        //
        // Until the PR is resolved, we need to wrap the component in a React
        // component class.
        component = wrapInComponent(component as React.StatelessComponent<TProps>);
      }
    }

    // Okay, at this point we have a sensible value for both 'name' and
    // 'component'.

    this._registry[name] = { component };

    return name;
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
   * Alias to the `removeListener()` method to allow the workbench object to be
   * used with `react-event-listener` or other classes that expect a DOM-like
   * API.
   */
  public removeEventListener(eventName: string | symbol, listener?: ListenerFn): void {
    this.removeListener(capitalizeEventName(eventName), listener);
  }

  /**
   * Renders the workbench in the given node of the page.
   *
   * @param  node  the node to render the workbench into; omitting it means that
   *         the workbench must fill the entire page.
   */
  public render(node?: Element | JQuery<HTMLElement> | Text | string): void {
    this._domNode = node !== undefined ? this._resolve(node) : document.body;

    // Sanity checks; we cannot proceed if we are not configured or if we are
    // already rendered
    if (this._config === undefined) {
      throw new Error("Workbench is not configured yet");
    }

    if (this._layout !== undefined) {
      throw new Error("Workbench has already been rendered");
    }

    // Attach an event handler for resize events if the given node is not the
    // document body
    if (this._domNode !== undefined && this._domNode !== document.body) {
      window.addResizeListener(this._domNode, this._onWorkbenchResized);
    }

    // Create the golden-layout object and set it
    const layout = this._createLayoutFromConfig(this._config);
    this._setLayout(layout);
  }

  /**
   * Restores a saved state previously obtained by <code>getState()</code>.
   */
  public restoreState(state: WorkbenchState): void {
    if (this._domNode !== undefined) {
      // Create a completely new golden-layout object with the new configuration
      const layout = this._createLayoutFromConfig(state);
      this._setLayout(layout);
    } else {
      // Just pretend that this was a call to configure()
      this.configure(state);
    }
  }

  /**
   * Updates the size of the workbench to the given values. If no values
   * are given, the workbench will measure the DOM node it is attached to
   * and adjusts its own size to the size of that node.
   */
  public updateSize(width?: number, height?: number): void {
    if (this._layout) {
      // Block stateChanged events for the next 300 msec because
      // this._layout.updateSize() would also dispatch a stateChanged event
      // that we are not interested it (it is not really a state change)
      this._blockNextEvent("stateChanged", 300);
      this._layout.updateSize(width, height);
    }
  }

  /**
   * Blocks the next event with the given name coming from the wrapped workbench
   * instance so it is not re-dispatched from this instance.
   *
   * @param  event     the name of the event to block
   * @param  duration  the duration for which the event will be blocked, in
   *                   milliseconds
   */
  private _blockNextEvent(event: string, duration: number): void {
    const unblockId: number = this._nextUnblockId++;
    this._blockedEvents[event] = unblockId;
    setTimeout(() => {
      if (this._blockedEvents[event] === unblockId) {
        delete this._blockedEvents[event];
      }
    }, duration);
  }

  /**
   * Creates a new <code>golden-layout</code> object from the current
   * configuration object and the DOM node that the workbench is associated
   * to.
   *
   * The method must be called only after the workbench was associated to a
   * DOM node.
   *
   * This method takes care of post-processing the provided configuration
   * object such that the appropriate context is provided for React components
   * where needed.
   *
   * @return  the newly created <code>golden-layout</code> object
   */
  private _createLayoutFromConfig(config: GoldenLayout.Config): GoldenLayout {
    if (this._domNode === undefined) {
      throw new Error("Workbench is not associated to a DOM node yet");
    }

    // Create the final configuration object by merging the user-defined
    // config over our defaults
    const effectiveConfig: GoldenLayout.Config = merge(
      {}, this._configDefaults, config
    );

    const layout: GoldenLayout = new GoldenLayout(effectiveConfig, this._domNode);

    // HACK: Get rid of the default React component handler from GoldenLayout
    (layout as any)._components = {};

    Object.keys(this._registry).forEach((key: string) => {
      let { component } = this._registry[key];
      const { factory } = this._registry[key];
      if (component !== undefined && this.hoc !== undefined) {
        component = this.hoc(component);
      }
      layout.registerComponent(key, component || factory);
    });

    return layout;
  }

  /**
   * Returns the <code>golden-layout</code> object associated to the workbench
   * if it has been created already yet, or throws an exception if the workbench
   * is not ready.
   */
  private _getLayout(): GoldenLayout {
    if (!this._layout) {
      throw new Error("Workbench has not been rendered yet");
    }
    return this._layout;
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

  /**
   * Event handler that is called when the DOM node hosting the workbench
   * has been resized.
   */
  private _onWorkbenchResized = (): void => {
    this.updateSize();
  }

  /**
   * Proposes a location for a new item in the workbench.
   *
   * The function will find the largest visible panel in the workbench and then
   * it will attempt to split the panel in half.
   *
   * @return  the place where a new item should be added in the workbench
   */
  private _proposePlaceForNewItem(): IWorkbenchPlace {
    if (this.layout === undefined) {
      throw new Error("Cannot propose place for a new item in a workbench " +
                      "when it is not mounted");
    }

    return proposePlaceForNewItemInLayout(this.layout);
  }

  /**
   * Re-dispatches the given event originating from the wrapped workbench
   * object, optionally swallowing certain events that we want to suppress.
   */
  private _redispatch = (event: string, ...args: any[]): void => {
    if (this._blockedEvents[event] > 0) {
      delete this._blockedEvents[event];
    } else {
      this.emit(event, ...args);
    }
  }

  /**
   * Sets the <code>golden-layout</code> object associated to the workbench.
   * Also takes care of registering or deregistering all the event handlers
   * that the Workbench instance might be interested in.
   */
  private _setLayout(value: GoldenLayout | undefined): void {
    if (this._layout === value) {
      return;
    }

    if (this._layout !== undefined) {
      // The order is important here: first we destroy, then we unregister
      // ourselves from all events. This is because the layout will fire
      // itemDestroyed events during destruction, which others might be
      // interested in.
      this._layout.destroy();
      this._layout.off("__all", this._redispatch, this);
    }

    this._layout = value;

    if (this._layout !== undefined) {
      this._layout.on("__all", this._redispatch, this);
      this._layout.init();
    }

    this.emit("layoutChanged", this._layout);
  }

  private _resolve(node: Element | JQuery<HTMLElement> | Text | string): HTMLElement {
    if (typeof node === "string") {
      const result = document.getElementById(node && node.charAt(0) === "#" ? node.substr(1) : node);
      if (result !== null) {
        return result;
      } else {
        throw new Error("Cannot find DOM node: " + node);
      }
    } else if (node instanceof JQuery) {
      return (node as JQuery<HTMLElement>).get(0);
    } else {
      return node as HTMLElement;
    }
  }

}
