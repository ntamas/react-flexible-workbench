import * as GoldenLayout from "golden-layout";
import isFunction from "lodash-es/isFunction";
import * as PropTypes from "prop-types";
import * as React from "react";

import { DragSource, ItemConfigType } from "../types";
import { Workbench } from "../workbench";

export function createItemConfigurationFromProps(props: IModuleProps): (() => ItemConfigType) {
  return () => {
    const { component, eager, id, itemConfiguration, onStartDrag } = props;
    let result;

    if (onStartDrag) {
      onStartDrag();
    }

    if (itemConfiguration !== undefined) {
      result = Object.assign({},
        isFunction(itemConfiguration) ? itemConfiguration() : itemConfiguration
      );
    } else if (component !== undefined) {
      const { label, title, workbench } = props;
      if (workbench === undefined) {
        throw new Error("Workbench is undefined; this should not have happened");
      }
      result = workbench.createItemConfigurationFor(component, {
        eager,
        props: props.props,
        title: title || (typeof label === "string" ? label : "Untitled")
      }) as GoldenLayout.ReactComponentConfig;
    } else {
      throw new Error("At least one of 'component' and 'itemConfiguration' " +
                      "must be defined");
    }

    if (id !== undefined) {
      result.id = id;
    }

    return result;
  };
}

/**
 * Props of a single module component in a module drawer.
 */
export interface IModuleProps {
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
   * The React component to show in the new item that will be created when the
   * module is dropped on the workbench. Note that <code>itemConfiguration</code>
   * takes precedence over this prop if both are given.
   */
  component?: React.ComponentType<any>;

  /**
   * Whether the module component is disabled. A disabled component cannot be
   * dragged out of its drawer.
   */
  disabled?: boolean;

  /**
   * Whether the module should produce a component that is eagerly mounted,
   * i.e. that mounts itself to the DOM tree even if it is in the background
   * in some tab stack.
   */
  eager?: boolean;

  /**
   * An optional icon for the module.
   */
  icon?: React.ReactNode;

  /**
   * A unique identifier for the module. When given, and the layout already
   * contains a module with the same ID, the module component in the module
   * drawer will be disabled.
   */
  id?: string;

  /**
   * Configuration object of the new item that will be created when the module
   * is dropped on the workbench. Can be omitted; in this case, the Configuration
   * object will be derived from <code>component</code> and <code>props</code>.
   */
  itemConfiguration?: ItemConfigType | (() => ItemConfigType);

  /**
   * The label of the module.
   */
  label: React.ReactNode;

  /**
   * Callback function to call when the user clicked on the module.
   */
  onClick?: (event?: React.SyntheticEvent<any>) => void;

  /**
   * Callback function to call when the module has been torn out of its drawer
   * by the user.
   */
  onStartDrag?: () => void;

  /**
   * The props of the new item that will be created when the module is dropped
   * on the workbench. Note that <code>itemConfiguration</code> takes precedence
   * over this prop if both are given.
   */
  props?: any;

  /**
   * The title of the panel that is created for the module, or a function that
   * returns the title when invoked with no arguments. When omitted, it defaults
   * to the label of the module when the label is a string.
   */
  title?: string | (() => string);

  /**
   * The workbench that the module can be dragged into.
   */
  workbench?: Workbench;
}

export class Module extends React.Component<IModuleProps, {}> {

  private _dragSource?: DragSource;
  private _rootNode: HTMLElement | null;
  private _workbench: Workbench | undefined;

  public constructor(props: IModuleProps) {
    super(props);
    this._rootNode = null;
  }

  public componentDidMount() {
    this._setWorkbench(this.props.workbench);
  }

  public componentWillReceiveProps(newProps: IModuleProps) {
    const disabledChanged = (!!newProps.disabled !== !!this.props.disabled);

    if (disabledChanged) {
      this._removeDragSourceFromWorkbench(this.props.workbench);
    }

    this._setWorkbench(newProps.workbench);

    if (disabledChanged) {
      this._updateDragSourceForProps( /* rootNodeChanged = */ false, newProps);
    }
  }

  public componentWillUnmount() {
    this._setWorkbench(undefined);
  }

  public render() {
    const { badge, disabled, icon, label } = this.props;
    const classes = ["wb-module"];

    if (disabled) {
      classes.push("wb-module-disabled");
    }

    const iconSpan = icon ? <span className="wb-icon wb-module-icon">{icon}</span> : null;
    const labelSpan = label ? <span className="wb-label wb-module-label">{label}</span> : null;

    return (
      <div onClick={disabled ? undefined : this._onClick}
        className={classes.join(" ")} ref={this._setRootNode}>
        { icon ? (
            badge ? (
              <div className="wb-badge-container">{iconSpan}{badge}</div>
            ) : iconSpan
          ) : iconSpan }
        { labelSpan }
      </div>
    );
  }

  private _onClick = (event: React.SyntheticEvent<any>) => {
    const { onClick } = this.props;
    if (onClick) {
      onClick(event);
    }
  }

  private _onWorkbenchLayoutChanged = () => {
    this._removeDragSourceFromWorkbench(this.props.workbench);
    this._updateDragSourceForProps( /* rootNodeChanged = */ false);
  }

  private _setRootNode = (node: HTMLElement | null) => {
    if (this._rootNode === node) {
      return;
    }

    this._rootNode = node;
    this._updateDragSourceForProps( /* rootNodeChanged = */ true);
  }

  private _setWorkbench = (workbench: Workbench | undefined) => {
    if (this._workbench === workbench) {
      return;
    }

    if (this._workbench !== undefined) {
      this._workbench.off("layoutChanged", this._onWorkbenchLayoutChanged);
    }

    this._workbench = workbench;

    if (this._workbench !== undefined) {
      this._workbench.on("layoutChanged", this._onWorkbenchLayoutChanged);
    }
  }

  private _updateDragSourceForProps = (
    rootNodeChanged: boolean,
    props?: IModuleProps
  ) => {
    props = (props !== undefined) ? props : this.props;
    const { disabled, workbench } = props;
    const node = this._rootNode;
    const needsDragSource = (node !== null && node !== undefined &&
                             workbench !== undefined &&
                             workbench.isRendered && !disabled);
    if (needsDragSource) {
      if (this._dragSource === undefined || rootNodeChanged) {
        this._removeDragSourceFromWorkbench(workbench);
        this._dragSource = workbench!.createDragSource(
          node!, createItemConfigurationFromProps(props) as any
        );
      }
    } else {
      this._removeDragSourceFromWorkbench(workbench);
    }
  }

  private _removeDragSourceFromWorkbench = (workbench: Workbench | undefined) => {
    if (this._dragSource !== undefined) {
      if (workbench !== undefined) {
        workbench.removeDragSource(this._dragSource);
      }
      this._dragSource = undefined;
    }
  }

}
