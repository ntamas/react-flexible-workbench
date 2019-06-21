import { IWorkbenchState } from "../types";

/**
 * Interface specification for the visual style of a perspective.
 *
 * The visual style of a perspective defines how a button or other UI widget
 * representing the perspective looks like on the user interface.
 */
export interface IPerspectiveVisualStyle {
  /**
   * A preferred color to represent the perspective on the UI, in CSS
   * notation.
   */
  color?: string;

  /**
   * A preferred icon to represent the perspective on the UI.
   */
  icon?: string;

  /**
   * A human-readable name of the perspective.
   */
  label: string;
}

/**
 * Interface specification for objects that represent a perspective, i.e.
 * a saved configuration of panels on the workbench.
 */
export interface IPerspective extends IPerspectiveVisualStyle {
  /**
   * The state of the saved perspective, in a form that is suitable for
   * serialization.
   */
  state: IWorkbenchState;
}
