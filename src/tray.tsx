import * as PropTypes from "prop-types";
import * as React from "react";

import { Workbench } from "./workbench";

/**
 * Child context that is passed down from a module tray to its descendents.
 */
export interface IModuleTrayChildContext {
  workbench: Workbench;
}

/**
 * Props of a module tray component.
 */
export interface IModuleTrayProps {
  workbench: Workbench;
}

/**
 * State of a module tray component.
 */
export interface IModuleTrayState {
  indexOfOpenDrawer: number;
}

/**
 * A module tray that holds multiple module drawers, each of which can be
 * opened in order to reveal a set of draggable placeholders that can be used
 * to place new components in a workbench.
 */
export class ModuleTray extends React.Component<IModuleTrayProps, IModuleTrayState> {

  public static childContextTypes = {
    workbench: PropTypes.instanceOf(Workbench)
  };

  public constructor(props: IModuleTrayProps) {
    super(props);
    this.state = {
      indexOfOpenDrawer: NaN
    };
  }

  public getChildContext(): IModuleTrayChildContext {
    const { workbench } = this.props;
    return { workbench };
  }

  public render() {
    const { children } = this.props;
    const { indexOfOpenDrawer } = this.state;
    const drawers = React.Children.map(this.props.children,
      (child: React.ReactNode, index: number) => {
        if (child && child.hasOwnProperty("props")) {
          child = React.cloneElement(child as any, {
            isOpen: index === indexOfOpenDrawer,
            onClose: this._onTrayClosed.bind(this, index),
            onOpen: this._onTrayOpened.bind(this, index),
          });
        }
        return child;
      });
    return (
      <div className="wb-module-tray">{drawers}</div>
    );
  }

  private _onTrayOpened(index: number): void {
    this.setState({
      indexOfOpenDrawer: index
    });
  }

  private _onTrayClosed(index: number): void {
    this.setState({
      indexOfOpenDrawer: NaN
    });
  }

}
