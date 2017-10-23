import * as React from "react";

export type MenuButtonShape = "menu" | "close";

interface IMenuButtonProps {
  color?: string;
  onClick?: (event: React.SyntheticEvent<any>) => void;
  padding?: number;
  shape?: MenuButtonShape;
  style?: React.CSSProperties;
  thickness?: number;
  width?: number;
}

export const MenuButton = (props: IMenuButtonProps) => {
  const padding: number = props.padding !== undefined ? props.padding : 6;
  const shape: MenuButtonShape = props.shape || "menu";
  const thickness: number = props.thickness || 2;
  const width: number = props.width || 18;
  const style: React.CSSProperties = {
    alignItems: "center",
    background: "transparent",
    border: "none",
    boxSizing: "border-box",
    display: "flex",
    flexFlow: "column nowrap",
    height: 9 * thickness + 2 * padding,
    justifyContent: "space-between",
    outline: "none",
    padding: (padding + thickness) + "px " + padding + "px",
    width: width + 2 * padding,
    ...props.style
  } as React.CSSProperties;
  const barStyle: React.CSSProperties = {
    boxSizing: "border-box",
    height: thickness,
    transition: "0.3s ease-out",
    width
  };

  if (props.color) {
    barStyle.backgroundColor = props.color;
  }

  const extraStyles: { [key: string]: React.CSSProperties } = {
    bottom: {
      transformOrigin: "0 50% 0"
    },
    middle: {},
    top: {
      transformOrigin: "0 50% 0"
    }
  };

  switch (shape) {
    case "menu":
      break;

    case "close":
      const commonTransform = "scaleX(" +
        (7 * thickness * 1.4142) / width +
      ") translate(" + (
        (width - 7 * thickness * 1.4142) / 2
      ) + "px, 0)";
      extraStyles.top.transform = "rotate(45deg) " + commonTransform +
        " translate(0, " + (-thickness / 4) + "px)";
      extraStyles.middle.transform = "scaleX(0)";
      extraStyles.bottom.transform = "rotate(-45deg) " + commonTransform +
        " translate(0, " + (thickness / 4) + "px)";
      break;
  }

  return (
    <div style={style} onClick={props.onClick}>
      <div style={{ ...extraStyles.top, ...barStyle}} />
      <div style={{ ...extraStyles.middle, ...barStyle}} />
      <div style={{ ...extraStyles.bottom, ...barStyle}} />
    </div>
  );
};
