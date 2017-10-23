import * as React from "react";

import { IModuleDrawerProps, ModuleDrawer } from "./drawer";
import { IModuleProps, Module } from "./module";

import { Workbench } from "../workbench";

export function convertModuleInTray(
  options: {
    isModuleEnabled?: (props: IModuleProps) => boolean,
    onClick?: (props: IModuleProps, event: React.SyntheticEvent<any>) => void,
    onStartDrag?: () => void,
    workbench?: Workbench
  },
  element: React.ReactElement<IModuleProps>
) {
  const { isModuleEnabled, onClick, onStartDrag, workbench } = options;
  const { props } = element;
  const newProps: Partial<IModuleProps> = {
    onClick: onClick ? onClick.bind(null, props) : undefined,
    onStartDrag,
    workbench
  };
  if (isModuleEnabled !== undefined) {
    newProps.disabled = !isModuleEnabled(props);
  }
  return React.cloneElement(element, newProps);
}
