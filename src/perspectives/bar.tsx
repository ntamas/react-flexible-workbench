import * as React from "react";

import { ModificationIndicator } from "./indicator";
import { IPerspective } from "./perspective";
import { IPerspectiveStorage } from "./storage";

import { Workbench } from "../workbench";

/**
 * Props of the perspective bar component.
 */
export interface IPerspectiveBarProps {
  /**
   * The perspective storage that the perspective bar uses to store
   * perspectives.
   */
  storage?: IPerspectiveStorage;

  /**
   * The workbench that the perspective bar is associated to.
   */
  workbench: Workbench;
}

/**
 * State of the perspective bar component.
 */
export interface IPerspectiveBarState {
  /**
   * Dummy counter that can be used to force updates to the perspective bar.
   */
  counter: number;

  /**
   * ID of the selected perspective that the user is currently editing.
   */
  selectedPerspectiveId: string | undefined;
}

export class PerspectiveBar extends React.Component<IPerspectiveBarProps, IPerspectiveBarState> {

  /**
   * When this variable is positive, the next state change event from the
   * workbench will be ignored and the variable will be decremented by one.
   * When this variable is zero or negative, the state change event from
   * the workbench will update the <code>perspectiveChanged</code> state
   * variable of the bar.
   */
  private _ignoreStateChangeCounter: number;

  private _storage: IPerspectiveStorage | undefined;
  private _workbench: Workbench | undefined;

  constructor(props: IPerspectiveBarProps) {
    super(props);
    this._ignoreStateChangeCounter = 0;
    this.state = {
      counter: 0,
      selectedPerspectiveId: undefined
    };
  }

  public componentDidMount() {
    this._setStorage(this.props.storage);
    this._setWorkbench(this.props.workbench);
  }

  public componentWillReceiveProps(newProps: IPerspectiveBarProps) {
    this._setStorage(newProps.storage);
    this._setWorkbench(newProps.workbench);
  }

  public componentWillUnmount() {
    this._setStorage(undefined);
    this._setWorkbench(undefined);
  }

  public render() {
    const { storage, workbench } = this.props;
    const { selectedPerspectiveId } = this.state;
    const buttons: React.ReactNode[] = [];

    if (storage !== undefined) {
      storage.forEach((perspective, id) => {
        const element = this._createLoadButtonFromStoredPerspective(
          perspective, id, storage.isModified(id)
        );
        const selected = selectedPerspectiveId === id;
        const extraProps: Partial<ILoadPerspectiveButtonProps> = {
          onClick: selected ?
            this._revertModificationsOfCurrentPerspective.bind(this) :
            this._loadPerspectiveById.bind(this, id),
          selected
        };
        buttons.push(React.cloneElement(element, extraProps));
      });
      buttons.push(<NewPerspectiveButton key="__new" onClick={this._createNewPerspective} />);
      buttons.push(<SavePerspectiveButton key="__save" onClick={this._persistModificationsOfCurrentPerspective}
                                          disabled={!storage.isModified(selectedPerspectiveId)} />);
    }

    return <div className="wb-perspective-bar">{buttons}</div>;
  }

  private _createLoadButtonFromStoredPerspective =
    (perspective: IPerspective, id: string, modified: boolean): React.ReactElement<ILoadPerspectiveButtonProps> => {
    const { label } = perspective;
    return (
      <LoadPerspectiveButton key={id} label={label} modified={modified} />
    );
  }

  private _createNewPerspective = (): void => {
    const { workbench } = this.props;
    console.log(workbench.getState());
    alert("Not implemented yet");
  }

  private _loadPerspectiveById = async (id: string): Promise<void> => {
    const { storage } = this.props;
    if (storage !== undefined) {
      const perspective = await storage.load(id);
      const { workbench } = this.props;
      if (workbench !== undefined) {
        this._ignoreStateChangeCounter++;
        workbench.restoreState(perspective.state);
      } else {
        console.warn("Workbench is gone while the perspective was being loaded; this is probably a bug.");
      }
      this.setState({
        selectedPerspectiveId: id
      });
    } else {
      console.warn("No perspective storage while loading perspective by ID; this is probably a bug.");
    }
  }

  private _onStorageChanged = (): void => {
    this.setState({
      counter: 1 - this.state.counter
    });
  }

  private _onWorkbenchChanged = (): void => {
    if (this._ignoreStateChangeCounter > 0) {
      this._ignoreStateChangeCounter--;
    } else {
      this._updateCurrentPerspective();
    }
  }

  private _persistModificationsOfCurrentPerspective = async (): Promise<void> => {
    return this._updateCurrentPerspective(true);
  }

  private _revertModificationsOfCurrentPerspective = async (): Promise<void> => {
    const { storage } = this.props;
    const { selectedPerspectiveId } = this.state;

    if (storage !== undefined) {
      if (selectedPerspectiveId !== undefined) {
        await storage.revertModifications(selectedPerspectiveId);
        await this._loadPerspectiveById(selectedPerspectiveId);
      }
    } else {
      console.warn("No perspective storage while reverting perspective by ID; this is probably a bug.");
    }
  }

  private _setStorage(value: IPerspectiveStorage | undefined): void {
    if (this._storage === value) {
      return;
    }

    if (this._storage !== undefined) {
      this._storage.unsubscribe(this._onStorageChanged);
    }

    this._storage = value;

    if (this._storage !== undefined) {
      this._storage.subscribe(this._onStorageChanged);
    }
  }

  private _setWorkbench(value: Workbench | undefined): void {
    if (this._workbench === value) {
      return;
    }

    if (this._workbench !== undefined) {
      this._workbench.off("stateChanged", this._onWorkbenchChanged);
    }

    this._workbench = value;

    if (this._workbench !== undefined) {
      this._workbench.on("stateChanged", this._onWorkbenchChanged);
    }
  }

  private _updateCurrentPerspective = async (persist: boolean = false): Promise<void> => {
    const { storage, workbench } = this.props;
    const { selectedPerspectiveId } = this.state;

    if (storage === undefined) {
      console.warn("No perspective storage while saving perspective; this is probably a bug.");
    } else if (selectedPerspectiveId !== undefined) {
      await storage.update(selectedPerspectiveId, workbench.getState());
      if (persist) {
        await storage.persistModifications(selectedPerspectiveId);
      }
    }
  }

}

/**
 * Props for the button that allows the user to load a perspective.
 */
export interface ILoadPerspectiveButtonProps {
  /**
   * Label of the button to show.
   */
  label?: React.ReactNode;

  /**
   * Whether the perspective was modified by the user compared to its last
   * stored base state in the perspective storage.
   */
  modified?: boolean;

  /**
   * Handler to call when the user clicks on the button in order to load the
   * perspective.
   */
  onClick?: (event: React.SyntheticEvent<any>) => void;

  /**
   * Whether the perspective is currently selected.
   */
  selected?: boolean;
}

/**
 * Stateless component that renders a button that can be clicked by the user
 * to load a perspective.
 */
const LoadPerspectiveButton = (props: ILoadPerspectiveButtonProps) => {
  const { label, modified, onClick, selected } = props;
  const classes = ["wb-perspective-bar-item"];
  if (selected) {
    classes.push("wb-perspective-selected");
  }
  if (modified) {
    classes.push("wb-perspective-modified");
  }
  return (
    <div className={classes.join(" ")}>
      <button className="wb-perspective-bar-load-button" onClick={onClick}>{label}</button>
      <ModificationIndicator visible={modified} />
    </div>
  );
};

/**
 * Props for the button that allows the user to create a new perspective.
 */
export interface INewPerspectiveButtonProps {
  /**
   * Handler to call when the user clicks on the button in order to save the
   * current configuration as a new perspective.
   */
  onClick?: (event: React.SyntheticEvent<any>) => void;
}

/**
 * Stateless component that renders a button that can be clicked by the user
 * to load a perspective.
 */
const NewPerspectiveButton = ({ onClick }: INewPerspectiveButtonProps) => {
  return (
    <div className="wb-perspective-bar-item">
      <button className="wb-perspective-bar-new-button"
              onClick={onClick}>+ New</button>
    </div>
  );
};

/**
 * Props for the button that allows the user to save a perspective.
 */
export interface ISavePerspectiveButtonProps {
  /**
   * Whether the button is enabled.
   */
  disabled?: boolean;

  /**
   * Handler to call when the user clicks on the button in order to save the
   * current configuration as a perspective.
   */
  onClick?: (event: React.SyntheticEvent<any>) => void;
}

/**
 * Stateless component that renders a button that can be clicked by the user
 * to load a perspective.
 */
const SavePerspectiveButton = ({ disabled, onClick }: ISavePerspectiveButtonProps) => {
  return (
    <div className="wb-perspective-bar-item">
      <button className="wb-perspective-bar-save-button"
              disabled={disabled} onClick={onClick}>Save</button>
    </div>
  );
};
