import * as GoldenLayout from "golden-layout";
import isNil from "lodash-es/isNil";
import pullAll from "lodash-es/pullAll";
import * as React from "react";

import { IModuleDrawerProps, ModuleDrawer } from "./drawer";
import { createItemConfigurationFromProps, IModuleProps, Module } from "./module";
import { convertModuleInTray, idOfModuleDrawer } from "./utils";

import { extractIdsFromContentItem, isElementClassEqualTo } from "../utils";
import { Workbench } from "../workbench";

/**
 * Props of a module tray component.
 */
export interface IModuleTrayProps {
  allowMultipleSelection?: boolean;
  onChange?: (id: string, open: boolean) => void;
  openDrawers?: string[];
  style?: React.CSSProperties;
  vertical?: boolean;
  workbench: Workbench;
}

/**
 * State of a module tray component.
 */
export interface IModuleTrayState {
  openDrawers: string[];
  visibleIds: string[];
}

/**
 * A module tray that holds multiple module drawers, each of which can be
 * opened in order to reveal a set of draggable placeholders that can be used
 * to place new components in a workbench.
 */
export class ModuleTray extends React.Component<IModuleTrayProps, IModuleTrayState> {

  private _visibleIds: string[];
  private _workbench: Workbench | undefined;

  public static getDerivedStateFromProps(props: IModuleTrayProps) {
    const { openDrawers } = props;

    // If the component is controlled, openDrawers in state should be copied
    // from props
    return (openDrawers !== undefined) ? { openDrawers } : null;
  }

  public constructor(props: IModuleTrayProps) {
    super(props);

    this._visibleIds = [];

    this.state = {
      openDrawers: React.Children.map(this.props.children || [],
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
            onClose: this._onDrawerClosed.bind(this, id),
            onOpen: this._onDrawerOpened.bind(this, id),
            open: openDrawers.includes(id),
            workbench
          };
          if (child.props.closeAfterDragging === undefined) {
            newProps.closeAfterDragging = !this._isControlled() && !allowMultipleSelection;
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
   * Commits the list of item IDs visible in the workbench to the state of
   * this component from the corresponding local variable.
   */
  private _commitVisibleIdsToState = (): void => {
    this.setState({
      visibleIds: this._visibleIds.concat()
    });
  }

  /**
   * Returns whether the tray is controlled.
   */
  private _isControlled = (): boolean => this.props.openDrawers !== undefined;

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
    this._visibleIds = [];

    if (this._workbench !== undefined) {
      this._workbench.on("itemCreated", this._onItemCreated);
      this._workbench.on("itemDestroyed", this._onItemDestroyed);
      this._workbench.on("itemDropped", this._onItemDropped);

      this._updateVisibleIds();
    }

    this._commitVisibleIdsToState();
  }

  private _onDrawerOpened(id: string): void {
    if (this.props.onChange) {
      this.props.onChange(id, true);
    }
    if (!this._isControlled()) {
      const { allowMultipleSelection } = this.props;
      const openDrawers = allowMultipleSelection ? this.state.openDrawers.concat() : [];
      openDrawers.push(id);
      this.setState({ openDrawers });
    }
  }

  private _onDrawerClosed(id: string): void {
    if (this.props.onChange) {
      this.props.onChange(id, false);
    }
    if (!this._isControlled()) {
      const { allowMultipleSelection } = this.props;
      const openDrawers = allowMultipleSelection ?
        this.state.openDrawers.filter(x => x !== id) : [];
      this.setState({ openDrawers });
    }
  }

  private _onItemCreated = (item: GoldenLayout.ContentItem): void => {
    const ids = extractIdsFromContentItem(item);
    const isDragging = document.body.classList.contains("lm_dragging");
    if (!isDragging) {
      this._visibleIds.push(...ids);
      this._commitVisibleIdsToState();
    }
  }

  private _onItemDestroyed = (item: GoldenLayout.ContentItem): void => {
    const ids = extractIdsFromContentItem(item);
    if (ids.length > 0) {
      pullAll(this._visibleIds, ids);
      this._commitVisibleIdsToState();
    }
  }

  private _onItemDropped = (): void => {
    this._updateVisibleIds();
    this._commitVisibleIdsToState();
  }

  /**
   * Updates the list of visible IDs by scanning the workbench.
   *
   * Note that this only updates the _visibleIds private variable but it does
   * not commit it ot the state yet.
   */
  private _updateVisibleIds = (): void => {
    this._visibleIds.length = 0;

    if (this._workbench !== undefined) {
      this._workbench.forEach(item => {
        this._visibleIds.push.apply(this._visibleIds,
          extractIdsFromContentItem(item));
      });
    }
  }
}
