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
}

const BrowserEnvironment: IEnvironmentMethods = {
  confirm: (message: string): Promise<boolean> => (
    Promise.resolve(window.confirm(message))
  )
};

export const Environment: { [type: string]: IEnvironmentMethods } = {
  browser: BrowserEnvironment
};
