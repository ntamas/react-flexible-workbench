import * as React from "react";

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
   * Whether the current perspective has changed since it was loaded.
   */
  perspectiveChanged: boolean;

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

  private _workbench: Workbench | undefined;

  constructor(props: IPerspectiveBarProps) {
    super(props);
    this._ignoreStateChangeCounter = 0;
    this.state = {
      perspectiveChanged: false,
      selectedPerspectiveId: undefined
    };
  }

  public componentDidMount() {
    this._setWorkbench(this.props.workbench);
  }

  public componentWillReceiveProps(newProps: IPerspectiveBarProps) {
    this._setWorkbench(newProps.workbench);
  }

  public componentWillUnmount() {
    this._setWorkbench(undefined);
  }

  public render() {
    const { storage, workbench } = this.props;
    const { perspectiveChanged, selectedPerspectiveId } = this.state;
    const buttons: React.ReactNode[] = [];

    if (storage !== undefined) {
      storage.forEach(perspective => {
        const { id } = perspective;
        const element = this._createLoadButtonFromStoredPerspective(perspective);
        const extraProps: Partial<ILoadPerspectiveButtonProps> = {
          onClick: this._loadPerspectiveById.bind(this, id),
          selected: selectedPerspectiveId === id
        };
        buttons.push(React.cloneElement(element, extraProps));
      });
      buttons.push(<NewPerspectiveButton key="__new" onClick={this._createNewPerspective} />);
      buttons.push(<SavePerspectiveButton key="__save" onClick={this._saveCurrentPerspective}
                                          disabled={selectedPerspectiveId === undefined || !perspectiveChanged} />);
    }

    return <div className="wb-perspective-bar">{buttons}</div>;
  }

  private _createLoadButtonFromStoredPerspective =
    (perspective: IPerspective): React.ReactElement<ILoadPerspectiveButtonProps> => {
    const { id, label } = perspective;
    return (
      <LoadPerspectiveButton key={id} label={label} />
    );
  }

  private _createNewPerspective = (): void => {
    const { workbench } = this.props;
    console.log(workbench.getState());
    alert("Not implemented yet");
  }

  private _loadPerspectiveById(id: string) {
    const { storage } = this.props;
    if (storage !== undefined) {
      storage.load(id).then(perspective => {
        const { workbench } = this.props;
        if (workbench !== undefined) {
          this._ignoreStateChangeCounter++;
          workbench.restoreState(perspective.state);
        } else {
          console.warn("Workbench is gone while the perspective was being loaded; this is probably a bug.");
        }
        this.setState({
          perspectiveChanged: false,
          selectedPerspectiveId: perspective.id
        });
      });
    } else {
      console.warn("No perspective storage while loading perspective by ID; this is probably a bug.");
    }
  }

  private _onWorkbenchChanged = (): void => {
    if (this._ignoreStateChangeCounter > 0) {
      this._ignoreStateChangeCounter--;
    } else {
      this.setState({
        perspectiveChanged: true
      });
    }
  }

  private _saveCurrentPerspective = (): void => {
    const { workbench } = this.props;
    console.log(workbench.getState());
    alert("Not implemented yet");
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
  const { label, onClick, selected } = props;
  const classes = ["wb-perspective-bar-load-button"];
  if (selected) {
    classes.push("wb-perspective-selected");
  }
  return <button className={classes.join(" ")} onClick={onClick}>{label}</button>;
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
  return <button className="wb-perspective-bar-new-button" onClick={onClick}>+ New</button>;
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
  return <button className="wb-perspective-bar-save-button"
                 disabled={disabled} onClick={onClick}>Save</button>;
};
