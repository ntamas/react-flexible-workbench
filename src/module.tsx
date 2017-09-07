import * as GoldenLayout from "golden-layout";
import { isFunction } from "lodash";
import * as PropTypes from "prop-types";
import * as React from "react";

import { DragSource, ItemConfigType } from "./types";
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
   * The React component to show in the new item that will be created when the
   * module is dropped on the workbench. Note that <code>itemConfiguration</code>
   * takes precedence over this prop if both are given.
   */
  component?: React.ComponentClass<any>;

  /**
   * Whether the module component is disabled. A disabled component cannot be
   * dragged out of its drawer.
   */
  disabled?: boolean;

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
    const { disabled, label } = this.props;
    const classes = ["wb-module"];

    if (disabled) {
      classes.push("wb-module-disabled");
    }

    return (
      <li className={classes.join(" ")} ref={this._setRootNode}>{ label }</li>
    );
  }

  private _createItemConfigurationFromProps = (props?: IModuleProps): (() => ItemConfigType) => {
    const effectiveProps = (props === undefined) ? this.props : props;
    return () => {
      const { component, itemConfiguration, onStartDrag } = effectiveProps;
      if (onStartDrag) {
        onStartDrag();
      }

      if (itemConfiguration !== undefined) {
        return Object.assign({},
          isFunction(itemConfiguration) ? itemConfiguration() : itemConfiguration
        );
      } else if (component !== undefined) {
        const { label, title } = effectiveProps;
        const { workbench } = this.context;
        const config = workbench.createItemConfigurationFor(component) as GoldenLayout.ReactComponentConfig;
        config.title = title
          ? (isFunction(title) ? title() : title)
          : (typeof label === "string" ? label : "Untitled");
        config.props = Object.assign({}, effectiveProps.props);
        return config;
      } else {
        throw new Error("At least one of 'component' and 'itemConfiguration' " +
                        "must be defined");
      }
    };
  }

  private _setRootNode = (node: HTMLElement | null) => {
    if (this._rootNode === node) {
      return;
    }

    this._rootNode = node;
    this._updateDragSourceForProps( /* rootNodeChanged = */ true);
  }

  private _updateDragSourceForProps = (
    rootNodeChanged: boolean,
    props?: IModuleProps
  ) => {
    props = (props !== undefined) ? props : this.props;
    const { disabled } = props;
    const { workbench } = this.context;
    const node = this._rootNode;
    const needsDragSource = (node !== null && node !== undefined && !disabled);

    if (needsDragSource) {
      if (this._dragSource === undefined || rootNodeChanged) {
        this._dragSource = workbench.createDragSource(
          node!, this._createItemConfigurationFromProps(props) as any
        );
      }
    } else {
      if (this._dragSource !== undefined) {
        workbench.removeDragSource(this._dragSource);
        this._dragSource = undefined;
      }
    }
  }

}
