import { Container } from "golden-layout";
import uniqueId from "lodash-es/uniqueId";
import * as React from "react";
import { render, unmountComponentAtNode } from "react-dom";

// Polyfill MutationObserver for browsers that don't support it.
require("mutation-observer");

// Add support for document.arrive()
require("arrive");

/**
 * Golden-layout component handler for React components that are meant to
 * be mounted lazily. Such components are mounted only when they become
 * visible and unmounted when they become hidden.
 */
export class LazyReactComponentHandler {

  private _container: Container;
  private _isOpen: boolean;
  private _isVisible: boolean;
  private _originalComponentWillUpdate: ((...args: any[]) => void) | undefined;
  private _reactClass: React.SFC<any> | React.ComponentClass<any> | string;
  private _reactComponent: React.Component<any, any> | undefined;
  private _temporaryClassNameForContainer: string | undefined;
  private _waitingForContainerAddition: HTMLElement | undefined;

  /**
   * Constructor.
   *
   * @param {lm.container.ItemContainer}  container  the container that
   *        will contain the React component
   * @param {Object} state  the state of the React component; optional
   */
  constructor(container: Container, state: any) {
    this._isOpen = false;
    this._isVisible = false;
    this._setReactComponent(null);
    this._temporaryClassNameForContainer = undefined;
    this._waitingForContainerAddition = undefined;

    this._container = container;
    this._container.on("open", this._open, this);
    this._container.on("destroy", this._destroy, this);
    this._container.on("show", this._show, this);
    this._container.on("hide", this._hide, this);

    this._reactClass = this._getReactClass();
  }

  /**
   * Event handler for the 'show' event; mounts the component in the DOM
   * if it is already open.
   */
  private _show(): void {
    this._isVisible = true;
    this._mountIfNeeded();
  }

  /**
   * Event handler for the 'hide' event; unmounts the component from the DOM
   * if it is still mounted.
   */
  private _hide(): void {
    this._isVisible = false;
    this._unmountIfNeeded();
  }

  /**
   * Event handler for the 'open' event; mounts the component in the DOM
   * if it is in a visible tab.
   */
  private _open(): void {
    this._isOpen = true;
    this._mountIfNeeded();
  }

  /**
   * Event handler for the 'destroy' event; unmounts the component from the
   * DOM if it is still mounted. Also detaches from any relevant events of
   * the container that we were subscribed to.
   */
  private _destroy(): void {
    this._isOpen = false;
    this._isVisible = false;
    this._unmountIfNeeded();

    this._container.off("open", this._open, this);
    this._container.off("destroy", this._destroy, this);
    this._container.off("show", this._show, this);
    this._container.off("hide", this._hide, this);
  }

  /**
   * Mounts the component to the DOM tree if it should be mounted and it is
   * not mounted yet.
   */
  private _mountIfNeeded(): void {
    if (this._reactComponent || !this._isVisible || !this._isOpen) {
      return;
    }

    const firstElement = this._container.getElement()[0];
    if (!document.body.contains(firstElement)) {
      // Container is not in the DOM tree yet, so let's start watching the
      // DOM tree and try mounting again if it is finally added
      this._waitForContainerAddition(firstElement);
    } else {
      render(
        this._createReactComponent(this._setReactComponent), firstElement
      );
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
    this._mountIfNeeded();
  }

  private _setReactComponent = (component: React.Component<any, any> | null): void => {
    this._reactComponent = component || undefined;

    /* tslint:disable:no-empty */
    if (this._reactComponent) {
      this._originalComponentWillUpdate =
        this._reactComponent.componentWillUpdate || (() => {});
      this._reactComponent.componentWillUpdate = this._onUpdate;

      const state = this._container.getState();
      if (state) {
        this._reactComponent.setState(state);
      }
    } else {
      this._originalComponentWillUpdate = undefined;
    }
    /* tslint:enable:no-empty */

  }

  /**
   * Unmounts the component from the DOM tree. This method is called when
   * the component is hidden or destroyed. It is safe to call this method
   * even if the component is already unmounted; nothing will happen in this
   * case.
   */
  private _unmountIfNeeded(): void {
    if (this._reactComponent && (!this._isVisible || !this._isOpen)) {
      // Unmount the component from the container
      const firstElement = this._container.getElement()[0];
      unmountComponentAtNode(firstElement);

      // Don't wait for the mounting of any DOM node any more
      this._waitForContainerAddition(undefined);
    }
  }

  /**
   * Hooks into React's state management and applies the component state
   * to GoldenLayout
   *
   * @param  nextProps  the next set of properties for the React component
   * @param  nextState  the next state for the React component
   */
  private _onUpdate = (nextProps: any, nextState: any): void => {
    this._container.setState(nextState);
    if (this._originalComponentWillUpdate !== undefined) {
      this._originalComponentWillUpdate.call(
        this._reactComponent, nextProps, nextState
      );
    }
  }

  /**
   * Retrieves the React class from GoldenLayout's registry
   *
   * @returns the React class whose instance will be shown in the layout
   */
  private _getReactClass(): React.SFC<any> | React.ComponentClass<any> | string {
    const componentName = (this._container as any)._config.component;
    if (!componentName) {
      throw new Error("No react component name. type: lazy-react-component " +
                      "needs a field `component`");
    }

    const reactClass = this._container.layoutManager.getComponent(componentName);
    if (!reactClass) {
      throw new Error("React component \"" + componentName + "\" not found. " +
        "Please register all components with GoldenLayout using `registerComponent(name, component)`");
    }

    return reactClass;
  }

  /**
   * Copies and extends the properties array and returns the React element
   *
   * @returns the React component instance that will be shown in the layout
   */
  private _createReactComponent(ref: (component: any) => any) {
    const defaultProps = {
      glContainer: this._container,
      glEventHub: this._container.layoutManager.eventHub,
    };
    const configProps = (this._container as any)._config.props;
    const props = Object.assign(defaultProps, configProps, { ref });
    return React.createElement(this._reactClass, props);
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
