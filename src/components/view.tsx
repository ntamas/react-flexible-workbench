import * as React from "react";
import { findDOMNode } from "react-dom";

import { Workbench } from "../workbench";

export interface IWorkbenchViewProps {
  id?: string;
  style?: React.CSSProperties;
  workbench?: Workbench;
}

/**
 * React component that shows a prepared and configured Workbench object.
 */
export class WorkbenchView extends React.Component<IWorkbenchViewProps, {}> {

  /**
   * Flag to store whether the workbench *is* currently attached to
   * the DOM or not.
   */
  private _isAttached: boolean;

  /**
   * Flag to store whether the component is currently mounted or not.
   */
  private _isMounted: boolean;

  /**
   * Flag to store whether the workbench *should* currently be attached to
   * the DOM or not.
   */
  private _shouldBeAttached: boolean;

  /**
   * The workbench that is currently attached to the ODM tree.
   */
  private _workbench: Workbench | undefined;

  constructor(props: IWorkbenchViewProps) {
    super(props);
    this._isAttached = false;
    this._isMounted = false;
    this._shouldBeAttached = false;
    this._workbench = undefined;
  }

  public componentDidMount() {
    this._isMounted = true;
    this._setWorkbench(this.props.workbench);
    this._renderOrDetachWorkbenchIfNeeded();
  }

  public componentDidUpdate() {
    this._setWorkbench(this.props.workbench);
  }

  public componentWillUnmount() {
    this._isMounted = false;
    this._setWorkbench(undefined);
    this._renderOrDetachWorkbenchIfNeeded();
  }

  public render() {
    const effectiveStyle: React.CSSProperties = {
      ...this.props.style,
      flexGrow: 1,
      height: "100%",
      overflow: "hidden",
      position: "relative"
    };
    return <div id={this.props.id} style={effectiveStyle}></div>;
  }

  private _renderOrDetachWorkbenchIfNeeded(): void {
    const shouldBeAttached = this._workbench !== undefined &&
      this._shouldBeAttached && this._isMounted;

    if (shouldBeAttached && !this._isAttached) {
      const node = findDOMNode(this);
      if (node === null) {
        throw new Error("No DOM node found for WorkbenchView. " +
                        "This is most likely a bug.");
      } else {
        this._workbench!.render(node);
      }
    } else if (!shouldBeAttached && this._isAttached) {
      this._workbench!.detach();
    }

    this._isAttached = shouldBeAttached;
  }

  private _setWorkbench(value: Workbench | undefined): void {
    if (value === this._workbench) {
      return;
    }

    this._shouldBeAttached = false;
    this._renderOrDetachWorkbenchIfNeeded();

    this._workbench = value;

    this._shouldBeAttached = true;
    this._renderOrDetachWorkbenchIfNeeded();
  }
}
