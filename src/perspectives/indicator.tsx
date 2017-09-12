import * as React from "react";
import Transition from "react-transition-group/Transition";

export interface IModificationIndicatorProps {
  /**
   * Whether the indicator is visible.
   */
  visible?: boolean;
}

export const ModificationIndicator = ({ visible }: IModificationIndicatorProps) => (
  <Transition timeout={300} in={visible}>
    {(state: string) => (
      <div className="wb-modification-indicator" style={{
        transform: (state === "entering" || state === "entered") ? "scale(1)" : "scale(0)",
        transition: "transform 300ms ease-in-out"
      }} />
    )}
  </Transition>
);
