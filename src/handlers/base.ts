import { Container } from "golden-layout";
import noop from "lodash-es/noop";
import uniqueId from "lodash-es/uniqueId";
import * as React from "react";
import { render, unmountComponentAtNode } from "react-dom";

import { ComponentFactory } from "./types";
import { getComponentGracefully } from "./utils";

// Polyfill MutationObserver for browsers that don't support it.
require("mutation-observer");

// Add support for document.arrive()
require("arrive");

/**
 * Base class of Golden-layout component handlers for React components.
 *
 * This class has two subclasses: EagerReactComponentHandler (which is a
 * functionally equivalent version of the original React component handler
 * in Golden-layout, with bugfixes and some extra functionality) and
 * LazyReactComponentHandler (which delays mounting the component until it
 * becomes visible).
 */
export class ReactComponentHandler {

  private _container: Container;
  private _isOpen: boolean;
  private _originalComponentDidUpdate: ((...args: any[]) => void) | undefined;
  private _reactComponentFactory: ComponentFactory;
  private _reactComponent: React.Component<any, any> | undefined;
  private _temporaryClassNameForContainer: string | undefined;
  private _waitingForContainerAddition: HTMLElement | undefined;

  /**
   * Constructor.
   *
   * @param {lm.container.ItemContainer}  container  the container that
   *        will contain the React component
   */
  constructor(container: Container) {
    this._isOpen = false;
    this._setReactComponent(null);
    this._temporaryClassNameForContainer = undefined;
    this._waitingForContainerAddition = undefined;

    this._container = container;
    this._container.on("open", this.onOpen, this);
    this._container.on("destroy", this.onDestroy, this);

    this._reactComponentFactory = this._getReactComponentFactory();
  }

  /**
   * Returns the container that the handler is working with.
   */
  protected get container(): Container {
    return this._container;
  }

  /**
   * Handler that is called internally when we were not able to create
   * the component factory from the data available to us in the layout
   * configuration.
   *
   * @param componentName  name of the component that we have attempted to
   *        create
   * @return an alternative component factory that should be used in place of
   *         the normal mechanism, or undefined if we should not provide a
   *         component for the user and throw an error instead
   */
  protected handleComponentCreationFailure(_: string): ComponentFactory | undefined {
    return undefined;
  }

  /**
   * Event handler for the 'destroy' event; unmounts the component from the
   * DOM if it is still mounted. Also detaches from any relevant events of
   * the container that we were subscribed to.
   */
  protected onDestroy(): void {
    this._isOpen = false;
    this.mountOrUnmountIfNeeded();

    this._container.off("open", this.onOpen, this);
    this._container.off("destroy", this.onDestroy, this);
  }

  /**
   * Event handler for the 'open' event; mounts the component in the DOM
   * if it is in a visible tab.
   */
  protected onOpen(): void {
    this._isOpen = true;
    this.mountOrUnmountIfNeeded();
  }

  /**
   * Returns whether the component should be mounted, given its current state.
   */
  protected shouldBeMounted(): boolean {
    return this._isOpen;
  }

  /**
   * Copies and extends the properties array and returns the React element
   *
   * @returns the React component instance that will be shown in the layout
   */
  private _createReactComponent(ref: (component: any) => any) {
    const isDragging = this._container.tab === undefined;
    const defaultProps = {
      glContainer: this._container,
      glDragging: isDragging,
      glEventHub: this._container.layoutManager.eventHub,
    };

    if (isDragging) {
      // When the component is not dragged any more, it will dispatch
      // a "tab" event
      this._container.on("tab", () => {
        this._container.off("tab");

        // When this event is handled, the DOM node for the component might not
        // be in the DOM tree yet, so we cannot call _render() immediately.
        // We defer the call by 50 msec, which should be enough to make sure
        // it is called in the next frame when the DOM has already been updated.
        setTimeout(() => { this._render(); }, 50);
      });
    }

    const configProps = (this._container as any)._config.props;
    const props = Object.assign(defaultProps, configProps, { ref });
    return this._reactComponentFactory(props);
  }

  /**
   * Retrieves the React class from GoldenLayout's registry
   *
   * @returns the React class whose instance will be shown in the layout
   */
  private _getReactComponentFactory(): (props: any) => React.ReactElement<any> {
    const componentName = (this._container as any)._config.component;
    let message: string | undefined;
    let reactClass: any;

    if (!componentName) {
      message = (
        "No React component name. Type: lm-react-component needs a field " +
        "`component`"
      );
    } else {
      reactClass =
        getComponentGracefully(this._container.layoutManager, componentName);
      if (reactClass === undefined) {
        message = (
          "React component \"" + componentName + "\" not found. " +
          "Please register all components with GoldenLayout using " +
          "`registerComponent(name, component)`"
        );
      }
    }

    if (reactClass) {
      return props => React.createElement(reactClass, props);
    } else {
      const factory = this.handleComponentCreationFailure(componentName);
      if (factory !== undefined) {
        return factory;
      }
      throw new Error(
        message || `Unknown error while rendering component ${componentName}`
      );
    }
  }

  /**
   * Mounts the component to the DOM tree if it should be mounted and it is
   * not mounted yet.
   */
  private _mount(): void {
    const firstElement = this._container.getElement()[0];
    if (!document.body.contains(firstElement)) {
      // Container is not in the DOM tree yet, so let's start watching the
      // DOM tree and try mounting again if it is finally added
      this._waitForContainerAddition(firstElement);
    } else {
      this._render();
    }
  }

  /**
   * Renders the component in the DOM tree or forces a re-rendering.
   * Does nothing if the container is not in the DOM tree.
   */
  private _render(): void {
    const firstElement = this._container.getElement()[0];
    if (document.body.contains(firstElement)) {
      render(
        this._createReactComponent(this._setReactComponent), firstElement
      );
    }
  }

  /**
   * Mounts the component to the DOM tree if it should be mounted and it is
   * not mounted yet, or unmounts the component if it should not be mounted
   * and it is mounted.
   */
  protected mountOrUnmountIfNeeded(): void {
    const mounted = !!this._reactComponent;
    const shouldBeMounted = this.shouldBeMounted();

    if (mounted && !shouldBeMounted) {
      this._unmount();
    } else if (!mounted && shouldBeMounted) {
      this._mount();
    }
  }

  /**
   * Callback that is called when the DOM node that will contain the
   * component itself is added to the DOM tree of the document.
   */
  private _onContainerAdded = (): void => {
    // Stop watching the container, it's not needed now.
    this._waitForContainerAddition(undefined);

    // Let's try mounting again.
    this.mountOrUnmountIfNeeded();
  }

  /**
   * Hooks into React's state management and applies the component state
   * to GoldenLayout
   *
   * @param  prevProps  the previous set of properties for the React component
   * @param  prevState  the previous state for the React component
   * @param  snapshot   the snapshot taken from the React component before the
   *         current update
   */
  private _onUpdate = (prevProps: any, prevState: any, snapshot: any): void => {
    if (this._reactComponent) {
      this._container.setState(this._reactComponent.state);
    }
    if (this._originalComponentDidUpdate !== undefined) {
      this._originalComponentDidUpdate.call(
        this._reactComponent, prevProps, prevState, snapshot
      );
    }
  }

  private _setReactComponent = (component: React.Component<any, any> | null): void => {
    this._reactComponent = component || undefined;

    /* tslint:disable:no-empty */
    if (this._reactComponent) {
      this._originalComponentDidUpdate =
        this._reactComponent.componentDidUpdate || noop;
      this._reactComponent.componentDidUpdate = this._onUpdate;

      const state = this._container.getState();
      if (state) {
        this._reactComponent.setState(state);
      }
    } else {
      this._originalComponentDidUpdate = undefined;
    }
    /* tslint:enable:no-empty */

  }

  /**
   * Unmounts the component from the DOM tree. This method is called when
   * the component is hidden or destroyed. It is safe to call this method
   * even if the component is already unmounted; nothing will happen in this
   * case.
   */
  private _unmount(): void {
    // Unmount the component from the container
    const firstElement = this._container.getElement()[0];
    unmountComponentAtNode(firstElement);

    // Don't wait for the mounting of any DOM node any more
    this._waitForContainerAddition(undefined);

    // Clear the reference for the component
    this._setReactComponent(null);
  }

  /**
   * Asks the handler to start waiting for the given DOM node to be mounted
   * to the DOM tree of the document.
   */
  private _waitForContainerAddition(element: HTMLElement | undefined): void {
    if (this._waitingForContainerAddition === element) {
      return;
    }

    if (this._waitingForContainerAddition) {
      // Get rid of the existing handler and the temporary class that we
      // have attached to the container.
      (document as any).unbindArrive(
        "." + this._temporaryClassNameForContainer,
        this._onContainerAdded
      );
      this._waitingForContainerAddition.classList.remove(
        this._temporaryClassNameForContainer!);
      this._temporaryClassNameForContainer = undefined;
    }

    this._waitingForContainerAddition = element;

    if (this._waitingForContainerAddition) {
      // Create a new handler for the given element.
      this._temporaryClassNameForContainer = uniqueId("__wb_container_");
      this._waitingForContainerAddition.classList.add(
        this._temporaryClassNameForContainer);
      (document as any).arrive(
        "." + this._temporaryClassNameForContainer,
        this._onContainerAdded
      );
    }
  }

}
