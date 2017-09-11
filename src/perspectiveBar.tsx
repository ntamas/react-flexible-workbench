import * as React from "react";

import { IPerspective, IPerspectiveStorage } from "./perspectives";
import { Workbench } from "./workbench";

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
   * ID of the selected perspective that the user is currently editing.
   */
  selectedPerspectiveId?: string;
}

export class PerspectiveBar extends React.Component<IPerspectiveBarProps, IPerspectiveBarState> {

  constructor(props: IPerspectiveBarProps) {
    super(props);
    this.state = {
      selectedPerspectiveId: undefined
    };
  }

  public render() {
    const { storage, workbench } = this.props;
    const { selectedPerspectiveId } = this.state;
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
      buttons.push(<SavePerspectiveButton key="__save" onClick={this._saveCurrentPerspective} />);
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

  private _loadPerspectiveById(id: string) {
    const { storage } = this.props;
    if (storage !== undefined) {
      storage.load(id).then(perspective => {
        const { workbench } = this.props;
        if (workbench !== undefined) {
          workbench.restoreState(perspective.state);
        } else {
          console.warn("Workbench is gone while the perspective was being loaded; this is probably a bug.");
        }
        this.setState({
          selectedPerspectiveId: perspective.id
        });
      });
    } else {
      console.warn("No perspective storage while loading perspective by ID; this is probably a bug.");
    }
  }

  private _saveCurrentPerspective = (): void => {
    const { workbench } = this.props;
    console.log(workbench.getState());
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
 * Props for the button that allows the user to save a perspective.
 */
export interface ISavePerspectiveButtonProps {
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
const SavePerspectiveButton = ({ onClick }: ISavePerspectiveButtonProps) => {
  return <button className="wb-perspective-bar-save-button" onClick={onClick}>+</button>;
};
