import { EventEmitter, ListenerFn } from "eventemitter3";
import * as GoldenLayout from "golden-layout";
import * as JQuery from "jquery";
import identity from "lodash-es/identity";
import isEqual from "lodash-es/isEqual";
import isFunction from "lodash-es/isFunction";
import merge from "lodash-es/merge";
import pick from "lodash-es/pick";
import * as React from "react";

import { Environment, IEnvironmentMethods } from "./environment";
import { ComponentRegistry } from "./registry";
import {
  DragSource, FallbackHandler, HigherOrderComponent,
  IItemConfigurationOptions, ItemConfigType, ItemVisitor, IWorkbenchPlace,
  IWorkbenchState, PanelPredicate, WorkbenchStateTransformer
} from "./types";
import {
  capitalizeEventName, onlyVisible,
  proposePlaceForNewItemInLayout, traverseWorkbench
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
  private _dragSources: DragSource[];
  private _domNode: Element | undefined;
  private _layout: GoldenLayout | undefined;
  private _nextUnblockId: number;
  private _registry: ComponentRegistry;
  private _stateGuard: WorkbenchStateTransformer;

  /**
   * The environment that the workbench lives in. Methods of this object are
   * used to communicate with the application that hosts the workbench.
   */
  public environment: IEnvironmentMethods = Environment.browser;

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
    this._stateGuard = identity;

    this._dragSources = [];

    this._registry = new ComponentRegistry();
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
   * Brings the given panel to the front in a workbench if the panel is
   * participating in a stack.
   *
   * @param  panel  the panel to bring to the front or its ID
   * @return whether the panel was found and brought to the front successfully
   */
  public bringToFront(panel: string | GoldenLayout.ContentItem): boolean {
    let currentPanel = typeof panel === "string" ? this.findPanelById(panel) : panel;
    let success = false;

    while (currentPanel) {
      const parent = currentPanel.parent;

      if (parent && parent.isStack) {
        parent.setActiveContentItem(currentPanel);
        success = true;
      }

      currentPanel = parent;
    }

    return success;
  }

  /**
   * Configures the workbench with the given configuration object. See the
   * documentation of <code>golden-layout</code> for more details.
   *
   * This function may be called multiple times. Subsequent calls will merge
   * the new configuration values into the ones that were previously applied.
   *
   * @param {GoldenLayout.Config} config  the configuration object
   * @param clean  whether the merging should be performed with a clean slate,
   *        i.e. not reusing the existing configuration
   */
  public configure(config: GoldenLayout.Config, { clean }: { clean?: boolean } = {}): void {
    if (clean) {
      this._config = merge({}, config);
    } else {
      this._config = merge({}, this._config, config);
    }
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
    const dragSource = this._getLayout().createDragSource(element, itemConfiguration);
    this._dragSources.push(dragSource);
    return dragSource;
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
      reorderEnabled: true,
      title: ""
    }, options);
    let result: ItemConfigType;
    const { eager, props, reorderEnabled, title } = effectiveOptions;

    if (this._registry.isRegisteredAsReact(name)) {
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
    (result as any).reorderEnabled = Boolean(reorderEnabled);

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
      name = this._registry.findRegisteredNameFor(nameOrComponent);
    }

    if (name === undefined) {
      if (typeof nameOrComponent === "string") {
        throw new Error("component is not registered in workbench yet");
      } else {
        name = this._registry.registerComponent(nameOrComponent);
      }
    }

    return name;
  }

  /**
   * Iterates over all panels in the workbench and finds the first one that
   * matches the given predicate.
   *
   * @param pred  the predicate
   */
  public findFirstPanelMatching(pred: PanelPredicate): GoldenLayout.ContentItem | undefined {
    let result;

    this.forEach((item: GoldenLayout.ContentItem) => {
      if (pred(item, this)) {
        result = item;
        return true;
      }
    });

    return result;
  }

  /**
   * Iterates over all panels in the workbench and finds the one that has the
   * given ID.
   *
   * @param id  the ID of the panel to look for
   * @param func [description]
   */
  public findPanelById(id: string): GoldenLayout.ContentItem | undefined {
    const predicate = (item: GoldenLayout.ContentItem) => (item.config && item.config.id === id);
    return this.findFirstPanelMatching(predicate);
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
   * Fallback component or function that is used to resolve errors when the
   * user tries to create a component that is not registered in the workbench.
   * The function will be called with the registered name of the component that
   * the user tried to create and its props, and it must return a React node
   * to render as fallback.
   */
  public get fallback(): FallbackHandler | undefined {
    return this._registry.fallback;
  }
  public set fallback(value: FallbackHandler | undefined) {
    this._registry.fallback = value;
  }

  /**
   * Returns the raw Golden-Layout object behind this workbench.
   */
  public get layout(): GoldenLayout | undefined {
    return this._layout;
  }

  /**
   * Registry that keeps track of the association between component names
   * (strings) and the corresponding React components or component factories.
   */
  public get registry(): ComponentRegistry {
    return this._registry;
  }

  /**
   * Returns a serialized representation of the current state of the workbench.
   *
   * Note that the state object returned here is not the full state of the
   * workbench, only the part that encodes where the panels are and how they
   * are sized relative to each other.
   */
  public getState(): IWorkbenchState {
    return pick(
      this._getLayout().toConfig(), ["content"]
    );
  }

  /**
   * Returns whether the workbench is currently attached to a DOM node.
   */
  public get isRendered(): boolean {
    return this._layout !== undefined;
  }

  /**
   * Removes the given drag source from the workbench so it cannot be used to
   * drag new items into the workbench any more.
   */
  public removeDragSource(dragSource: DragSource): void {
    if (!this.isRendered) {
      // workbench already detached and the drag sources were removed in
      // detach()
      return;
    }

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
  public restoreState(state: IWorkbenchState): void {
    if (this._domNode !== undefined) {
      // Create a completely new golden-layout object with the new configuration
      const layout = this._createLayoutFromConfig(state);
      this._setLayout(layout);
    } else {
      // Just pretend that this was a call to configure()
      this.configure(state, { clean: true });
    }
  }

  /**
   * Sets the state transformer function that takes a workbench state object
   * that is about to be applied to the workbench, and returns another one
   * (or the same one after some modifications) that _will_ actually be loaded
   * instead of the original one. This can be used to prevent the user from
   * seeing certain panels when a previously saved state object is restored.
   *
   * The default state transformer function is the identity function.
   */
  public setStateGuard(func: WorkbenchStateTransformer) {
    if (this._stateGuard === func) {
      return;
    }

    this._stateGuard = func;

    if (this._domNode !== undefined) {
      // Layout is already mounted, so we need to pass the current state
      // through the state guard
      const state: IWorkbenchState = this.getState();
      const newState: IWorkbenchState = this._stateGuard(state);
      if (!isEqual(state, newState)) {
        this.restoreState(newState);
      }
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

    // Filter the content of the configuration object if the user specified a
    // state guard
    if (effectiveConfig.content) {
      effectiveConfig.content = this._stateGuard({
        content: effectiveConfig.content
      }).content;
    }

    const layout: GoldenLayout = new GoldenLayout(effectiveConfig, this._domNode);
    this._registry.prepareLayout(layout, this.hoc);
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
      for (const dragSource of this._dragSources) {
        this.removeDragSource(dragSource);
      }
      this._dragSources.length = 0;

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
      return (node as JQuery<HTMLElement>).get(0)!;
    } else {
      return node as HTMLElement;
    }
  }

}
