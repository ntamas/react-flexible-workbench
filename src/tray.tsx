import * as GoldenLayout from "golden-layout";
import isArray from "lodash-es/isArray";
import pullAll from "lodash-es/pullAll";
import * as PropTypes from "prop-types";
import * as React from "react";

import { IModuleDrawerProps, ModuleDrawer } from "./drawer";
import { IModuleProps } from "./module";
import { isElementClassEqualTo } from "./utils";
import { Workbench } from "./workbench";

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
  visibleIds: string[];
}

/**
 * A module tray that holds multiple module drawers, each of which can be
 * opened in order to reveal a set of draggable placeholders that can be used
 * to place new components in a workbench.
 */
export class ModuleTray extends React.Component<IModuleTrayProps, IModuleTrayState> {

  private _visibleIds: string[];
  private _workbench: Workbench;

  public constructor(props: IModuleTrayProps) {
    super(props);
    this._visibleIds = [];
    this.state = {
      indexOfOpenDrawer: NaN,
      visibleIds: []
    };
  }

  public componentDidMount() {
    this._setWorkbench(this.props.workbench);
  }

  public componentWillReceiveProps(newProps: IModuleTrayProps) {
    this._setWorkbench(newProps.workbench);
  }

  public render() {
    const { children, workbench } = this.props;
    const { indexOfOpenDrawer } = this.state;
    const drawers = React.Children.map(this.props.children,
      (child: React.ReactChild, index: number) => {
        if (isElementClassEqualTo(ModuleDrawer, child)) {
          const newProps: Partial<IModuleDrawerProps> = {
            isOpen: index === indexOfOpenDrawer,
            onClose: this._onTrayClosed.bind(this, index),
            onOpen: this._onTrayOpened.bind(this, index),
            workbench
          };
          if (child.props.isModuleEnabled === undefined) {
            newProps.isModuleEnabled = this._isModuleNotVisible;
          }
          child = React.cloneElement(child as any, newProps);
        }
        return child;
      });
    return (
      <div className="wb-module-tray">{drawers}</div>
    );
  }

  /**
   * Extracts the component IDs from the given content item if it represents
   * a component in the layout.
   */
  private _extractIdsFromContentItem(item: GoldenLayout.ContentItem): string[] {
    const maybeIds = item.type === "component" && item.config ? item.config.id : [];
    if (maybeIds !== undefined) {
      return isArray(maybeIds) ? maybeIds : [maybeIds];
    } else {
      return [];
    }
  }

  /**
   * Returns whether the module with the given props is not visible in
   * the workbench corresponding to the tray.
   */
  private _isModuleNotVisible = (props: IModuleProps): boolean => {
    const { id } = props;
    return (id === undefined || this._visibleIds.indexOf(id) < 0);
  }

  /**
   * Sets the Workbench object associated to the module drawer.
   *
   * Also takes care of registering or deregistering all the event handlers
   * that the ModuleTray instance might be interested in.
   */
  private _setWorkbench(value: Workbench): void {
    if (this._workbench === value) {
      return;
    }

    if (this._workbench !== undefined) {
      this._workbench.off("itemCreated", this._onItemCreated);
      this._workbench.off("itemDestroyed", this._onItemDestroyed);
    }

    this._workbench = value;

    if (this._workbench !== undefined) {
      this._workbench.on("itemCreated", this._onItemCreated);
      this._workbench.on("itemDestroyed", this._onItemDestroyed);

      // TODO: iterate over all currently visible panels and fill the
      // _visibleIds array
    }
  }

  private _onItemCreated = (item: GoldenLayout.ContentItem): void => {
    const ids = this._extractIdsFromContentItem(item);
    if (ids.length > 0) {
      Array.prototype.push.apply(this._visibleIds, ids);
      this._updateVisibleIdsLater();
    }
  }

  private _onItemDestroyed = (item: GoldenLayout.ContentItem): void => {
    const ids = this._extractIdsFromContentItem(item);
    if (ids.length > 0) {
      pullAll(this._visibleIds, ids);
      this._updateVisibleIdsLater();
    }
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

  private _updateVisibleIds = (): void => {
    this.setState({
      visibleIds: this._visibleIds.concat()
    });
  }

  /**
   * This function is useful in cases when we want to update the set of
   * visible IDs in the workbench with a delay.
   *
   * This is needed during dragging because golden-layout already creates an
   * item when the user starts to drag it to the workbench, and in this case
   * it gets confused when we suddenly disable the drag source in the
   * corresponding drawer of the tray. Doing it after 100 msec seems to be
   * okay. Using window.requestAnimationFrame() did not seem to do the
   * trick.
   */
  private _updateVisibleIdsLater(): void {
    setTimeout(100, this._updateVisibleIds);
  }
}
