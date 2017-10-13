import { Container } from "golden-layout";
import * as React from "react";
import { render, unmountComponentAtNode } from "react-dom";

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

    render(
      this._createReactComponent(this._setReactComponent),
      this._container.getElement()[0]
    );
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
      const firstElement = this._container.getElement()[0];
      unmountComponentAtNode(firstElement);
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

}
