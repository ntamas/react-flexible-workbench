import * as React from "react";

import { Workbench } from "./workbench";

const raf = require("raf");

/**
 * Props of a module drawer component.
 */
export interface IModuleDrawerProps {
  /**
   * Whether the drawer is open or not.
   */
  isOpen?: boolean;

  /**
   * The label to show on the module drawer button.
   */
  label: React.ReactNode;

  /**
   * Handler to call when the drawer is about to be closed. It is the
   * responsibility of the handler to update the props of the drawer if the
   * drawer can be closed.
   */
  onClose?: (event?: React.SyntheticEvent<any>) => void;

  /**
   * Handler to call when the drawer is about to be opened. It is the
   * responsibility of the handler to update the props of the drawer if the
   * drawer can be opened.
   */
  onOpen?: (event?: React.SyntheticEvent<any>) => void;
}

/**
 * A single module drawer that can be opened to reveal a set of draggable
 * placeholders that can be used to place new components in a workbench.
 */
export class ModuleDrawer extends React.Component<IModuleDrawerProps, {}> {

  public render() {
    const { children, isOpen, label, onClose, onOpen } = this.props;
    const classes = ["wb-module-drawer"];
    classes.push(isOpen ? "wb-module-drawer-open" : "wb-module-drawer-closed");

    const items = isOpen ? React.Children.map(children, child => {
      if (child && child.hasOwnProperty("props")) {
        return React.cloneElement(child as any, {
          onStartDrag: () => raf(onClose)
        });
      }
    }) : [];
    const contents = isOpen && items.length > 0 ? (
      <div className="wb-module-drawer-anchor">
        <div className="wb-module-drawer-contents">
          <ul>{items}</ul>
        </div>
      </div>
    ) : [];

    return (
      <div className={classes.join(" ")}>
        {contents}
        <button onClick={isOpen ? onClose : onOpen }>{label}</button>
      </div>
    );
  }

}
