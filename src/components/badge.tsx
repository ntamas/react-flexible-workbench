import * as PropTypes from "prop-types";
import * as React from "react";

import Transition from "react-transition-group/Transition";

export interface IBadgeProps {
  /**
   * The corner where the badge will be anchored in the parent container,
   * assuming that the parent container is set to `position: relative` in
   * CSS.
   *
   * Defaults to `topRight` if an offset is given, otherwise defaults to
   * undefined.
   */
  anchor?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

  /**
   * The children of the badge.
   */
  children?: React.ReactNode | React.ReactNode[];

  /**
   * The color of the badge; any CSS notification is accepted.
   */
  color?: React.CSSProperties;

  /**
   * The offset of the badge from the upper right corner of its container.
   * The value of this prop must be an array of length 2. The first element is
   * the X offset; the second is the Y offset. Percentages are accepted as well
   * as exact numeric values in pixels.
   */
  offset?: Array<number | React.CSSPercentage>;

  /**
   * Whether the badge is visible.
   */
  visible?: boolean;
}

/**
 * Colored badge attached to the upper right corner of its container.
 * The container must be set to `position: relative` in CSS for the badge to
 * work nicely.
 */
export const Badge = ({ anchor, children, color, offset, visible }: IBadgeProps) => {
  const baseStyles: React.CSSProperties = {};
  const effectiveVisible: boolean = (visible === undefined) ? true : visible;

  if (anchor && !offset) {
    offset = [0, 0];
  }

  if (color) {
    baseStyles.background = color;
  }

  if (offset) {
    switch (anchor) {
      case "topLeft":
        baseStyles.top = offset[1];
        baseStyles.left = offset[0];
        break;

      case "bottomLeft":
        baseStyles.marginBottom = offset[1];
        baseStyles.left = offset[0];
        break;

      case "bottomRight":
        baseStyles.bottom = offset[1];
        baseStyles.right = offset[0];
        break;

      case "topRight":
      default:
        baseStyles.top = offset[1];
        baseStyles.right = offset[0];
    }
  }

  return (
    <Transition appear timeout={300} in={effectiveVisible}>
      {
        (state: string) => (
          <div className="wb-badge" style={{
            ...baseStyles,
            transform: (state === "entering" || state === "entered") ? "scale(1)" : "scale(0)",
            transition: "transform 300ms ease-in-out, background-color 300ms linear"
          }}>
            {children}
          </div>
        )
      }
    </Transition>
  );
};
