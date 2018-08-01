import * as GoldenLayout from "golden-layout";
import isNil from "lodash-es/isNil";
import pullAll from "lodash-es/pullAll";
import uniq from "lodash-es/uniq";
import * as React from "react";

import { IModuleDrawerProps, ModuleDrawer } from "./drawer";
import { createItemConfigurationFromProps, IModuleProps, Module } from "./module";
import { convertModuleInTray, idOfModuleDrawer } from "./utils";

import { ModuleDrawerId } from "../types";
import { extractIdsFromContentItem, isElementClassEqualTo } from "../utils";
import { Workbench } from "../workbench";

/**
 * Props of a module tray component.
 */
export interface IModuleTrayProps {
  allowMultipleSelection?: boolean;
  style?: React.CSSProperties;
  vertical?: boolean;
  workbench: Workbench;
}

/**
 * State of a module tray component.
 */
export interface IModuleTrayState {
  openDrawers: ModuleDrawerId[];
  visibleIds: string[];
}

/**
 * A module tray that holds multiple module drawers, each of which can be
 * opened in order to reveal a set of draggable placeholders that can be used
 * to place new components in a workbench.
 */
export class ModuleTray extends React.Component<IModuleTrayProps, IModuleTrayState> {

  private _draggedIds: string[];
  private _visibleIds: string[];
  private _workbench: Workbench | undefined;

  public constructor(props: IModuleTrayProps) {
    super(props);

    this._draggedIds = [];
    this._visibleIds = [];

    this.state = {
      openDrawers: React.Children.map(this.props.children,
        (child: React.ReactChild, index: number) => {
          if (isElementClassEqualTo(ModuleDrawer, child) && child.props.open) {
            return idOfModuleDrawer(child, index);
          } else {
            return "";
          }
        }
      ).filter(value => !isNil(value) && value !== ""),
      visibleIds: []
    };
  }

  public componentDidMount() {
    this._setWorkbench(this.props.workbench);
  }

  public componentDidUpdate() {
    this._setWorkbench(this.props.workbench);
  }

  public componentWillUnmount() {
    this._setWorkbench(undefined);
  }

  public render() {
    const { allowMultipleSelection, style, vertical, workbench } = this.props;
    const { openDrawers } = this.state;
    const isModuleEnabled = this._isModuleNotVisible;

    const drawers = React.Children.map(this.props.children,
      (child: React.ReactChild, index: number) => {
        if (isElementClassEqualTo(ModuleDrawer, child)) {
          const id = idOfModuleDrawer(child, index);
          const newProps: Partial<IModuleDrawerProps> = {
            onClick: this._addNewItemToWorkbench,
            onClose: this._onTrayClosed.bind(this, id),
            onOpen: this._onTrayOpened.bind(this, id),
            open: openDrawers.includes(id),
            workbench
          };
          if (child.props.closeAfterDragging === undefined) {
            newProps.closeAfterDragging = !allowMultipleSelection;
          }
          if (child.props.isModuleEnabled === undefined) {
            newProps.isModuleEnabled = isModuleEnabled;
          }
          child = React.cloneElement(child as any, newProps);
        } else if (isElementClassEqualTo(Module, child)) {
          return convertModuleInTray(
            {
              isModuleEnabled,
              onClick: this._addNewItemToWorkbench,
              workbench
            },
            child
          );
        }
        return child;
      });

    const classes = ["wb-module-tray"];
    if (vertical) {
      classes.push("wb-module-tray-vertical");
    }

    return (
      <div className={classes.join(" ")} style={style}>{drawers}</div>
    );
  }

  /**
   * Finds a place for a new item in the workbench if the user decides to
   * click on a module in the tray instead of dragging it to the workbench.
   */
  private _addNewItemToWorkbench = (props: IModuleProps): void => {
    if (this._workbench === undefined) {
      throw new Error("Cannot add new item when the tray is not associated " +
                      "to a workbench yet");
    }

    const config = createItemConfigurationFromProps({
      ...props,
      workbench: this._workbench
    })();

    this._workbench.addNewItemWithConfiguration(config);
  }

  /**
   * Returns whether the module with the given props is not visible in
   * the workbench corresponding to the tray.
   */
  private _isModuleNotVisible = (props: IModuleProps): boolean => {
    const { id } = props;
    return (id === undefined || !this._visibleIds.includes(id));
  }

  /**
   * Sets the Workbench object associated to the module drawer.
   *
   * Also takes care of registering or deregistering all the event handlers
   * that the ModuleTray instance might be interested in.
   */
  private _setWorkbench(value: Workbench | undefined): void {
    if (this._workbench === value) {
      return;
    }

    if (this._workbench !== undefined) {
      this._workbench.off("itemCreated", this._onItemCreated);
      this._workbench.off("itemDestroyed", this._onItemDestroyed);
      this._workbench.off("itemDropped", this._onItemDropped);
    }

    this._workbench = value;
    this._draggedIds = [];
    this._visibleIds = [];

    if (this._workbench !== undefined) {
      this._workbench.on("itemCreated", this._onItemCreated);
      this._workbench.on("itemDestroyed", this._onItemDestroyed);
      this._workbench.on("itemDropped", this._onItemDropped);

      this._workbench.forEach(item => {
        this._visibleIds.push.apply(this._visibleIds,
          extractIdsFromContentItem(item));
      });
    }

    this._updateVisibleIds();
  }

  private _onItemCreated = (item: GoldenLayout.ContentItem): void => {
    const ids = extractIdsFromContentItem(item);
    const isDragging = document.body.classList.contains("lm_dragging");
    if (isDragging) {
      this._draggedIds = ids;
    } else {
      Array.prototype.push.apply(this._visibleIds, ids);
      this._updateVisibleIds();
    }
  }

  private _onItemDestroyed = (item: GoldenLayout.ContentItem): void => {
    const ids = extractIdsFromContentItem(item);
    if (ids.length > 0) {
      pullAll(this._visibleIds, ids);
      this._updateVisibleIds();
    }
  }

  private _onItemDropped = (): void => {
    this._visibleIds = uniq(this._visibleIds.concat(this._draggedIds));
    this._draggedIds = [];
    this._updateVisibleIds();
  }

  private _onTrayOpened(id: ModuleDrawerId): void {
    const { allowMultipleSelection } = this.props;
    const openDrawers = allowMultipleSelection ? this.state.openDrawers.concat() : [];
    openDrawers.push(id);
    this.setState({ openDrawers });
  }

  private _onTrayClosed(id: ModuleDrawerId): void {
    const { allowMultipleSelection } = this.props;
    const openDrawers = allowMultipleSelection ?
      this.state.openDrawers.filter(x => x !== id) : [];
    this.setState({ openDrawers });
  }

  private _updateVisibleIds = (): void => {
    this.setState({
      visibleIds: this._visibleIds.concat()
    });
  }
}
