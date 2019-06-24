import { IPerspective } from "./perspectives";

/**
 * Interface for objects that describe the connection between a
 * workbench-related component and the application that the workbench is
 * interacting with. This object should provide methods that allow
 * workbench-related components to ask for confirmation, display an
 * alert message or request the user to provide some data.
 */
export interface IEnvironmentMethods {

  /**
   * Asks the application that the workbench is living in to show a dialog
   * box with a message that lets the user confirm an action.
   *
   * @param  message  the message that the application should show to the
   *                  user
   * @return a promise that resolves to true if the user confirmed the
   *         action or false if the user rejected the action.
   */
  confirm(message: string): Promise<boolean>;

  /**
   * Asks the application to prompt the user for the name and the visual
   * properties of a new perspective that is about to be created.
   *
   * @param  perspective  the perspective that is about to be created, with
   *         suggestions for its label, color and icon. The caller is allowed to
   *         modify the object
   * @return a promise that resolves to true if the user confirmed the
   *         creation of the new perspective or false if the user cancelled
   *         the creation of the new perspective
   */
  onCreatingNewPerspective(perspective: IPerspective): Promise<boolean>;

  /**
   * Asks the application to display a dialog box that allows the user to confirm
   * his intention to remove a perspective.
   *
   * @param  id  the ID of the perspective that is about to be removed
   * @param  perspective  the perspective that is about to be removed
   * @return a promise that resolves to true if the user confirmed the
   *         removal of the perspective or false if the user cancelled
   *         the removal of the perspective
   */
  onRemovingPerspective(id: string, perspective: IPerspective): Promise<boolean>;

}

const BrowserEnvironment: IEnvironmentMethods = {
  confirm: (message: string): Promise<boolean> => (
    Promise.resolve(window.confirm(message))
  ),

  onCreatingNewPerspective: (perspective: IPerspective): Promise<boolean> => {
    const label = window.prompt("Enter the name of the new perspective",
                                perspective.label);
    if (label !== undefined && label !== null && label.length > 0) {
      perspective.label = label;
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  },

  onRemovingPerspective: (): Promise<boolean> => {
    const confirmed = window.confirm("Are you sure you want to remove this perspective?");
    return Promise.resolve(confirmed);
  }
};

export const Environment: { [type: string]: IEnvironmentMethods } = {
  browser: BrowserEnvironment
};
