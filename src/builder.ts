import * as GoldenLayout from "golden-layout";

import {
  containersIn, filterState, panelsIn, transformState
} from "./iterators";
import { ComponentConstructor, ItemConfigType } from "./types";
import { Workbench } from "./workbench";

/**
 * Builder class with a fluid API that enables the user to build a
 * perspective of an existing workbench.
 */
export class PerspectiveBuilder {

  /**
   * The content of the perspective being built.
   */
  private _content: ItemConfigType[];

  /**
   * The stack of content objects being manipulated by the builder.
   */
  private _contentStack: ItemConfigType[];

  /**
   * When undefined, it means that the perspective is not finalized yet and
   * new panels may be added. When not undefined, it contains a GoldenLayout
   * configuration object with the finalized set of panels. After finalization,
   * no new panels may be added to the perspective; only filtering and
   * transformation is allowed.
   *
   * The first call to `filter()` or `map()` will implicitly finalize the
   * perspective and prevents the addition of any further panels.
   */
  private _finalizedConfiguration: GoldenLayout.Config | undefined;

  /**
   * The workbench being manipulated by this builder; <code>undefined</code>
   * if the builder has already built a perspective.
   */
  private _workbench: Workbench | undefined;

  /**
   * Constructor.
   *
   * Creates a new perspective builder that builds a new perspective
   * belonging to a given workbench.
   *
   * @param  workbench  the workbench that the perspective builder will
   *         manipulate when it registers new components
   */
  constructor(workbench: Workbench) {
    this._workbench = workbench;
    this._contentStack = [];
    this._content = [];
  }

  /**
   * Adds a new component to be shown in the current subdivision.
   */
  public add<TProps>(
    nameOrComponent: string | React.ComponentType<TProps>,
    { eager, title, props, state }: {
      props?: TProps,
      state?: any,
      title?: string,
      eager?: boolean
    } = {},
    id?: string
  ): this {
    this._assertNotFinalized();

    const workbench = this._assertHasWorkbench();
    const newItem = workbench.createItemConfigurationFor(
      nameOrComponent, { eager, props, title }
    );

    if (state !== undefined) {
      (newItem as GoldenLayout.ComponentConfig).componentState = state;
    }

    const panel = this._currentPanelContent;
    if (panel === undefined) {
      this._contentStack.push(newItem);
    } else {
      panel.push(newItem);
    }

    if (id !== undefined) {
      this.setId(id);
    }

    return this;
  }

  /**
   * Builds the perspective based on the set of configuration methods called
   * earlier in this call chain.
   */
  public build(): GoldenLayout.ItemConfigType[] {
    this._finalize();

    this._assertHasWorkbench();
    this._workbench = undefined;

    const result = this._content;
    this._content = [];

    return result;
  }

  /**
   * Iterates over each content item currently added to the perspective,
   * including containers, and removes those for which the given filter
   * predicate returns false.
   *
   * @param  pred  the filter predicate
   */
  public filter(pred: (item: ItemConfigType) => boolean): this {
    filterState(pred, this._finalize());
    return this;
  }

  /**
   * Iterates over each container currently added to the perspective,
   * not including panels, and removes those for which the given filter
   * predicate returns false.
   *
   * @param  pred  the filter predicate
   */
  public filterContainers(pred: (item: ItemConfigType) => boolean): this {
    filterState(pred, containersIn(this._finalize()));
    return this;
  }

  /**
   * Iterates over each panel currently added to the perspective,
   * not including containers, and removes those for which the given filter
   * predicate returns false.
   *
   * @param  pred  the filter predicate
   */
  public filterPanels(pred: (item: ItemConfigType) => boolean): this {
    filterState(pred, panelsIn(this._finalize()));
    return this;
  }

  /**
   * Declares that the current subdivision (row, column or stack) being built
   * is finished and moves back to the parent element.
   */
  public finish(): this {
    this._assertNotFinalized();

    if (this._contentStack.length === 0) {
      throw new Error("no panel is currently being built");
    }

    const poppedItem = this._contentStack.pop() as ItemConfigType;
    if (this._contentStack.length === 0) {
      this._content.push(poppedItem);
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
   * Iterates over each content item currently added to the perspective,
   * including containers, and transforms them via a mapping function.
   *
   * @param  func  the mapping function
   */
  public map(func: (item: ItemConfigType) => ItemConfigType): this {
    transformState(func, this._finalize());
    return this;
  }

  /**
   * Iterates over each container currently added to the perspective,
   * not including panels, and transforms them via a mapping function.
   *
   * @param  func  the mapping function
   */
  public mapContainers(func: (item: ItemConfigType) => ItemConfigType): this {
    transformState(func, containersIn(this._finalize()));
    return this;
  }

  /**
   * Iterates over each panel currently added to the perspective,
   * not including containers, and transforms them via a mapping function.
   *
   * @param  func  the mapping function
   */
  public mapPanels(func: (item: ItemConfigType) => ItemConfigType): this {
    transformState(func, panelsIn(this._finalize()));
    return this;
  }

  /**
   * Sets the identifier of the component that was added to the workbench
   * most recently.
   */
  public setId(value: string | string[]): this {
    return this.setProperties({
      id: typeof value === "string" ? value : value.concat()
    });
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
   * Sets the title of the component that was added to the workbench
   * most recently.
   */
  public setTitle(value: string): this {
    return this.setProperties({ title: value });
  }

  /**
   * Sets multiple properties of the last component that was added to the
   * workbench.
   */
  public setProperties(props: Partial<GoldenLayout.ItemConfigType>): this {
    Object.assign(this._lastAddedComponent, props);
    return this;
  }

  private _assertNotFinalized(): void {
    if (this._finalizedConfiguration) {
      throw new Error("no new panels may be added to the perspective any more");
    }
  }

  private _assertHasWorkbench(): Workbench {
    if (this._workbench === undefined) {
      throw new Error("builder has already built a workbench");
    }
    return this._workbench;
  }

  private get _currentPanel(): ItemConfigType | undefined {
    return this._contentStack.length > 0 ?
      this._contentStack[this._contentStack.length - 1] : undefined;
  }

  private get _currentPanelContent(): ItemConfigType[] | undefined {
    const panel = this._currentPanel;
    return panel ? panel.content : undefined;
  }

  private _finalize(): GoldenLayout.Config {
    if (this._finalizedConfiguration === undefined) {
      while (this._contentStack.length > 0) {
        this.finish();
      }

      if (this._content.length !== 1) {
        // Create an empty stack so we have something at the root
        this.makeStack().finish();
      }

      this._finalizedConfiguration = {
        content: this._content
      };
    }

    return this._finalizedConfiguration;
  }

  private get _lastAddedComponent(): ItemConfigType {
    const panel = this._currentPanel;
    const content = panel && panel.content && panel.content.length > 0 ?
      panel.content : undefined;
    if (content === undefined) {
      throw new Error("no component was added to the current panel yet");
    }
    return content[content.length - 1];
  }

  private _makeNewPanel(type: string): this {
    this._assertNotFinalized();

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

/**
 * Builder class with a fluid API that enables the user to build a complete
 * workbench object and its initial layout from scratch.
 */
export class WorkbenchBuilder {

  /**
   * The workbench being built by this builder; <code>undefined</code> if the
   * builder has already built one.
   */
  private _workbench: Workbench | undefined;

  /**
   * The wrapped perspective builder that the workbench builder uses.
   */
  private _builder: PerspectiveBuilder;

  /**
   * The global settings of the workbench being built.
   */
  private _settings: GoldenLayout.Settings;

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
    this._builder = new PerspectiveBuilder(this._workbench);
    this._settings = {};
  }

  /**
   * Adds a new component to be shown in the current subdivision.
   */
  public add<TProps>(
    nameOrComponent: string | React.ComponentType<TProps>,
    options: {
      props?: TProps,
      state?: any,
      title?: string
    } = {},
    id?: string
  ): this {
    this._builder.add(nameOrComponent, options, id);
    return this;
  }

  /**
   * Builds the workbench based on the set of configuration methods called
   * earlier in this call chain.
   */
  public build(): Workbench {
    const workbench = this._assertHasWorkbench();
    const configuration: GoldenLayout.Config = {
      content: this._builder.build(),
      settings: this._settings
    };

    this._workbench = undefined;
    workbench.configure(configuration);

    return workbench;
  }

  /**
   * Iterates over each content item currently added to the perspective,
   * including containers, and removes those for which the given filter
   * predicate returns false.
   *
   * @param  pred  the filter predicate
   */
  public filter(pred: (item: ItemConfigType) => boolean): this {
    this._builder.filter(pred);
    return this;
  }

  /**
   * Iterates over each container currently added to the perspective,
   * not including panels, and removes those for which the given filter
   * predicate returns false.
   *
   * @param  pred  the filter predicate
   */
  public filterContainers(pred: (item: ItemConfigType) => boolean): this {
    this._builder.filterContainers(pred);
    return this;
  }

  /**
   * Iterates over each panel currently added to the perspective,
   * not including containers, and removes those for which the given filter
   * predicate returns false.
   *
   * @param  pred  the filter predicate
   */
  public filterPanels(pred: (item: ItemConfigType) => boolean): this {
    this._builder.filterPanels(pred);
    return this;
  }

  /**
   * Declares that the current subdivision (row, column or stack) being built
   * is finished and moves back to the parent element.
   */
  public finish(): this {
    this._builder.finish();
    return this;
  }

  /**
   * Specifies that panel headers should *not* be shown in the workbench.
   */
  public hideHeaders(): this {
    return this.showHeaders(false);
  }

  /**
   * Subdivides the current panel in the workbench into multiple columns.
   * Subsequent calls to <code>add()</code> will add new columns to the workbench
   * within the subdivision.
   */
  public makeColumns(): this {
    this._builder.makeColumns();
    return this;
  }

  /**
   * Subdivides the current panel in the workbench into multiple rows.
   * Subsequent calls to <code>add()</code> will add new rows to the workbench
   * within the subdivision.
   */
  public makeRows(): this {
    this._builder.makeRows();
    return this;
  }

  /**
   * Subdivides the current panel in the workbench into multiple stacked items.
   * Subsequent calls to <code>add()</code> will add new items to the workbench
   * within the current stack.
   */
  public makeStack(): this {
    this._builder.makeStack();
    return this;
  }

  /**
   * Iterates over each content item currently added to the workbench,
   * including containers, and transforms them via a mapping function.
   *
   * @param  func  the mapping function
   */
  public map(func: (item: ItemConfigType) => ItemConfigType): this {
    this._builder.map(func);
    return this;
  }

  /**
   * Iterates over each container currently added to the workbench,
   * not including panels, and transforms them via a mapping function.
   *
   * @param  func  the mapping function
   */
  public mapContainers(func: (item: ItemConfigType) => ItemConfigType): this {
    this._builder.mapContainers(func);
    return this;
  }

  /**
   * Iterates over each panel currently added to the workbench,
   * not including containers, and transforms them via a mapping function.
   *
   * @param  func  the mapping function
   */
  public mapPanels(func: (item: ItemConfigType) => ItemConfigType): this {
    this._builder.mapPanels(func);
    return this;
  }

  /**
   * Sets the identifier of the component that was added to the workbench
   * most recently.
   */
  public setId(value: string | string[]): this {
    this._builder.setId(value);
    return this;
  }

  /**
   * Sets whether the component that was added to the workbench most recently
   * is closable or not.
   */
  public setClosable(value: boolean = true): this {
    this._builder.setClosable(value);
    return this;
  }

  /**
   * Sets the relative height of the component that was added to the workbench
   * most recently, in percentage, compared to its siblings in the same panel.
   */
  public setRelativeHeight(value: number): this {
    this._builder.setRelativeHeight(value);
    return this;
  }

  /**
   * Sets the relative width of the component that was added to the workbench
   * most recently, in percentage, compared to its siblings in the same panel.
   */
  public setRelativeWidth(value: number): this {
    this._builder.setRelativeWidth(value);
    return this;
  }

  /**
   * Sets the title of the component that was added to the workbench
   * most recently.
   */
  public setTitle(value: string): this {
    this._builder.setTitle(value);
    return this;
  }

  /**
   * Sets multiple properties of the last component that was added to the
   * workbench.
   */
  public setProperties(props: Partial<GoldenLayout.ItemConfigType>): this {
    this._builder.setProperties(props);
    return this;
  }

  /**
   * Specifies whether panel headers should be shown in the workbench.
   */
  public showHeaders(value: boolean = true): this {
    this._settings.hasHeaders = value;
    return this;
  }

  /**
   * Specifies whether maximise icons should be shown in the workbench.
   */
  public showMaximiseIcon(value: boolean = true): this {
    this._settings.showMaximiseIcon = value;
    return this;
  }

  public register<TState>(factory: ComponentConstructor<TState>): this;
  public register<TState>(name: string, factory: ComponentConstructor<TState>): this;
  public register<TState>(nameOrFactory: string | ComponentConstructor<TState>,
                          maybeFactory?: ComponentConstructor<TState>): this {
    const { registry } = this._assertHasWorkbench();
    registry.register.apply(registry, arguments);
    return this;
  }

  public registerComponent<TProps>(component: React.ComponentType<TProps>): this;
  public registerComponent<TProps>(name: string, component: React.ComponentType<TProps>): this;
  public registerComponent<TProps>(
    nameOrComponent: string | React.ComponentType<TProps>,
    maybeComponent?: React.ComponentType<TProps>
  ): any {
    const { registry } = this._assertHasWorkbench();
    registry.registerComponent.apply(registry, arguments);
    return this;
  }

  private _assertHasWorkbench(): Workbench {
    if (this._workbench === undefined) {
      throw new Error("builder has already built a workbench");
    }
    return this._workbench;
  }

}
