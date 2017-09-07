import * as GoldenLayout from "golden-layout";

import { ComponentConstructor } from "./types";
import { Workbench } from "./workbench";

export class Builder {

  /**
   * The workbench being built by this builder; <code>undefined</code> if the
   * builder has already built one.
   */
  private _workbench: Workbench | undefined;

  /**
   * The configuration object of this workbench.
   */
  private _config: GoldenLayout.Config;

  /**
   * The stack of content objects being manipulated by the builder.
   */
  private _contentStack: GoldenLayout.ItemConfigType[];

  /**
   * Constructor.
   *
   * Creates a new workbench builder that can build new Workbench instances.
   *
   * @param  factory   a factory function that returns a new Workbench instance
   *         when invoked with no arguments. When omitted, it defaults to simply
   *         calling <code>new Workbench()</code>.
   */
  constructor(factory?: () => Workbench) {
    this._workbench = factory ? factory() : new Workbench();
    this._contentStack = [];
    this._config = {
      content: [] as GoldenLayout.ItemConfigType[]
    };
  }

  /**
   * Adds a new component to be shown in the current subdivision.
   */
  public add<TProps>(
    nameOrComponent: string | React.ComponentType<TProps>,
    { title, props, state }: {
      props?: TProps,
      state?: any,
      title?: string
    } = {}
  ): this {
    let name: string | undefined;
    const workbench = this._assertHasWorkbench();

    if (typeof nameOrComponent === "string") {
      name = nameOrComponent;
    } else {
      name = workbench.findRegisteredNameFor(nameOrComponent);
    }

    if (name === undefined) {
      if (typeof nameOrComponent === "string") {
        throw new Error("component is not registered in workbench yet");
      } else {
        name = workbench.registerComponent(nameOrComponent);
      }
    }

    const panel = this._currentPanelContent;
    const newItem: GoldenLayout.ItemConfigType = workbench.isRegisteredAsReact(name) ? {
      component: name,
      props,
      type: "react-component"
    } : {
      componentName: name,
      componentState: state,
      type: "component"
    };
    newItem.title = title;
    if (panel === undefined) {
      this._contentStack.push(newItem);
    } else {
      panel.push(newItem);
    }

    return this;
  }

  /**
   * Builds the workbench based on the set of configuration methods called
   * earlier in this call chain.
   */
  public build(): Workbench {
    while (this._contentStack.length > 0) {
      this.finish();
    }

    const workbench = this._assertHasWorkbench();
    this._workbench = undefined;
    workbench.configure(this._config);
    return workbench;
  }

  /**
   * Declares that the current subdivision (row, column or stack) being built
   * is finished and moves back to the parent element.
   */
  public finish(): this {
    if (this._contentStack.length === 0) {
      throw new Error("no panel is currently being built");
    }

    const poppedItem = this._contentStack.pop() as GoldenLayout.ItemConfigType;
    if (this._contentStack.length === 0) {
      this._config.content!.push(poppedItem);
    }

    return this;
  }

  /**
   * Subdivides the current panel in the workbench into multiple columns.
   * Subsequent calls to <code>add()</code> will add new columns to the workbench
   * within the subdivision.
   */
  public makeColumns(): this {
    return this._makeNewPanel("row");
  }

  /**
   * Subdivides the current panel in the workbench into multiple rows.
   * Subsequent calls to <code>add()</code> will add new rows to the workbench
   * within the subdivision.
   */
  public makeRows(): this {
    return this._makeNewPanel("column");
  }

  /**
   * Subdivides the current panel in the workbench into multiple stacked items.
   * Subsequent calls to <code>add()</code> will add new items to the workbench
   * within the current stack.
   */
  public makeStack(): this {
    return this._makeNewPanel("stack");
  }

  /**
   * Sets whether the component that was added to the workbench most recently
   * is closable or not.
   */
  public setClosable(value: boolean = true): this {
    return this.setProperties({ isClosable: value });
  }

  /**
   * Sets the relative height of the component that was added to the workbench
   * most recently, in percentage, compared to its siblings in the same panel.
   */
  public setRelativeHeight(value: number): this {
    return this.setProperties({ height: value });
  }

  /**
   * Sets the relative width of the component that was added to the workbench
   * most recently, in percentage, compared to its siblings in the same panel.
   */
  public setRelativeWidth(value: number): this {
    return this.setProperties({ width: value });
  }

  /**
   * Sets multiple properties of the last component that was added to the
   * workbench.
   */
  public setProperties(props: Partial<GoldenLayout.ItemConfigType>): this {
    Object.assign(this._lastAddedComponent, props);
    return this;
  }

  public register<TState>(factory: ComponentConstructor<TState>): this;
  public register<TState>(name: string, factory: ComponentConstructor<TState>): this;
  public register<TState>(nameOrFactory: string | ComponentConstructor<TState>,
                          maybeFactory?: ComponentConstructor<TState>): this {
    this._assertHasWorkbench().register.apply(
      this._workbench, arguments
    );
    return this;
  }

  public registerComponent<TProps>(component: React.ComponentType<TProps>): this;
  public registerComponent<TProps>(name: string, component: React.ComponentType<TProps>): this;
  public registerComponent<TProps>(
    nameOrComponent: string | React.ComponentType<TProps>,
    maybeComponent?: React.ComponentType<TProps>
  ): any {
    this._assertHasWorkbench().registerComponent.apply(
      this._workbench, arguments
    );
    return this;
  }

  private _assertHasWorkbench(): Workbench {
    if (this._workbench === undefined) {
      throw new Error("builder has already built a workbench");
    }
    return this._workbench;
  }

  private get _currentPanel(): GoldenLayout.ItemConfigType | undefined {
    return this._contentStack.length > 0 ?
      this._contentStack[this._contentStack.length - 1] : undefined;
  }

  private get _currentPanelContent(): GoldenLayout.ItemConfigType[] | undefined {
    const panel = this._currentPanel;
    return panel ? panel.content : undefined;
  }

  private get _lastAddedComponent(): GoldenLayout.ItemConfigType {
    const panel = this._currentPanel;
    const content = panel && panel.content && panel.content.length > 0 ?
      panel.content : undefined;
    if (content === undefined) {
      throw new Error("no component was added to the current panel yet");
    }
    return content[content.length - 1];
  }

  private _makeNewPanel(type: string): this {
    const newPanel: GoldenLayout.ItemConfig = {
      content: [],
      type
    };
    if (this._currentPanelContent) {
      this._currentPanelContent.push(newPanel);
    }
    this._contentStack.push(newPanel);
    return this;
  }

}
