import * as React from "react";

import { isElementClassEqualTo } from "../utils";
import { Workbench } from "../workbench";

import { IModuleProps, Module } from "./module";
import { convertModuleInTray } from "./utils";

/**
 * Props of a module drawer component.
 */
export interface IModuleDrawerProps {
  /**
   * The React component to show as a badge on the icon. Typically, this
   * prop should be a `<Badge/>` component, but it may be anything else
   * as long as it is absolutely positioned in CSS, assuming that its parent
   * is a container that contains the icon as well.
   *
   * CSS effects applied to the icon in disabled state will not affect the
   * badge itself.
   */
  badge?: React.ReactNode;

  /**
   * Decides whether the module drawer should be closed when a module is
   * dragged out of it to the workbench.
   */
  closeAfterDragging?: boolean;

  /**
   * Unique identifier of the module drawer that is used by module trays in
   * which the drawers live to keep track of which drawers are open. When
   * omitted, the index of the drawer within the tray will be used.
   *
   * Don't use nil values (i.e. null, undefined or empty string) as the ID.
   */
  id?: string;

  /**
   * Function that decides whether a given module is enabled or not, based
   * on the props of the module.
   *
   * To avoid problems with golden-layout, this function must be designed
   * in a way that the item that the user starts to drag to the workbench
   * must be enabled; if it becomes disabled somehow before golden-layout
   * creates its drag proxy, golden-layout will freak out.
   */
  isModuleEnabled?: (props: IModuleProps) => boolean;

  /**
   * An optional icon for the module drawer button.
   */
  icon?: React.ReactNode;

  /**
   * The label to show on the module drawer button.
   */
  label: React.ReactNode;

  /**
   * Handler to call when the user clicked on a module in the module drawer.
   */
  onClick?: (moduleProps: IModuleProps, event?: React.SyntheticEvent<any>) => void;

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

  /**
   * Whether the drawer is open or not.
   */
  open?: boolean;

  /**
   * The workbench that the items in the drawer can be dragged into.
   */
  workbench?: Workbench;
}

/**
 * A single module drawer that can be opened to reveal a set of draggable
 * placeholders that can be used to place new components in a workbench.
 */
export class ModuleDrawer extends React.Component<IModuleDrawerProps, {}> {

  public render() {
    const { badge, children, closeAfterDragging, icon, isModuleEnabled, label,
            onClick, onClose, onOpen, open, workbench } = this.props;
    const classes = ["wb-module-drawer"];
    classes.push(open ? "wb-module-drawer-open" : "wb-module-drawer-closed");

    const items = React.Children.map(children, child => {
      if (isElementClassEqualTo(Module, child)) {
        return convertModuleInTray(
          {
            isModuleEnabled,
            onClick,
            onStartDrag: closeAfterDragging ? onClose : undefined,
            workbench
          },
          child
        );
      }
    });
    const contents = items && items.length > 0 ? (
      <div className="wb-module-drawer-anchor" style={{ display: open ? "block" : "none" }}>
        <div className="wb-module-drawer-contents">
          {items}
        </div>
      </div>
    ) : [];

    const iconSpan = icon ? <span className="wb-icon wb-module-drawer-icon">{icon}</span> : null;
    const labelSpan = label ? <span className="wb-label wb-module-drawer-label">{label}</span> : null;
    const iconAndBadge = iconSpan ? (
      <div className="wb-sidebar-icon-container">{iconSpan}{badge}</div>
    ) : null;

    return (
      <div className={classes.join(" ")}>
        {contents}
        <button onClick={open ? onClose : onOpen}>
          {iconAndBadge}
          {labelSpan}
        </button>
      </div>
    );
  }

}
