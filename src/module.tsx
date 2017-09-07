import { ItemConfigType } from "golden-layout";
import * as PropTypes from "prop-types";
import * as React from "react";

import { DragSource } from "./types";
import { Workbench } from "./workbench";

/**
 * Context of a single module component in a module drawer.
 */
export interface IModuleContext {
  workbench: Workbench;
}

/**
 * Props of a single module component in a module drawer.
 */
export interface IModuleProps {
  /**
   * The label of the module.
   */
  label: React.ReactNode;

  /**
   * Callback function to call when the module has been torn out of its drawer
   * by the user.
   */
  onStartDrag?: () => void;
}

export class Module extends React.Component<IModuleProps, {}> {

  public context: IModuleContext;

  public static contextTypes = {
    workbench: PropTypes.instanceOf(Workbench)
  };

  private _dragSource?: DragSource;
  private _rootNode: HTMLElement | null;

  public constructor(props: IModuleProps, context: IModuleContext) {
    super(props, context);
    this._rootNode = null;
  }

  public render() {
    const { label } = this.props;
    return (
      <li ref={this._setRootNode}>{ label }</li>
    );
  }

  private _createItemConfigurationFromProps = (): (() => ItemConfigType) => {
    return () => {
      const { onStartDrag } = this.props;
      if (onStartDrag) {
        onStartDrag();
      }
      return {
        componentName: "plain",
        componentState: { label: "X" },
        type: "component"
      };
    };
  }

  private _setRootNode = (node: HTMLElement | null) => {
    if (this._rootNode === node) {
      return;
    }

    const { workbench } = this.context;

    if (this._dragSource !== undefined) {
      workbench.removeDragSource(this._dragSource);
    }

    this._rootNode = node;

    if (this._rootNode !== null) {
      this._dragSource = workbench.createDragSource(
        // TODO: fix typing in golden-layout
        this._rootNode, this._createItemConfigurationFromProps() as any
      );
    } else {
      this._dragSource = undefined;
    }
  }

}
