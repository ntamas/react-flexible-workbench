import { Container } from "golden-layout";

import { ReactComponentHandler } from "./base";

/**
 * Golden-layout component handler for React components that are meant to
 * be mounted lazily. Such components are mounted only when they become
 * visible and unmounted when they become hidden.
 */
export class LazyReactComponentHandler extends ReactComponentHandler {

  private _isVisible: boolean;

  /**
   * Constructor.
   *
   * @param {lm.container.ItemContainer}  container  the container that
   *        will contain the React component
   */
  constructor(container: Container) {
    super(container);

    this._isVisible = false;

    this.container.on("show", this._onShow, this);
    this.container.on("hide", this._onHide, this);
  }

  /**
   * Event handler for the 'destroy' event; unmounts the component from the
   * DOM if it is still mounted. Also detaches from any relevant events of
   * the container that we were subscribed to.
   */
  protected onDestroy(): void {
    this.container.off("show", this._onShow, this);
    this.container.off("hide", this._onHide, this);

    this._isVisible = false;
    super.onDestroy();
  }

  /**
   * Returns whether the component should be mounted, given its current state.
   */
  protected shouldBeMounted(): boolean {
    return super.shouldBeMounted() && this._isVisible;
  }

  /**
   * Event handler for the 'show' event; mounts the component in the DOM
   * if it is already open.
   */
  private _onShow(): void {
    this._isVisible = true;
    this.mountOrUnmountIfNeeded();
  }

  /**
   * Event handler for the 'hide' event; unmounts the component from the DOM
   * if it is still mounted.
   */
  private _onHide(): void {
    this._isVisible = false;
    this.mountOrUnmountIfNeeded();
  }
}
