import * as GoldenLayout from "golden-layout";

/**
 * Helper function that attempts to retrieve a registered component with the
 * given name from the given layout, returning undefined instead of
 * throwing an error when the component is not registered.
 */
export function getComponentGracefully(layout: GoldenLayout, name: string): any {
  let component;
  try {
    component = layout.getComponent(name);
  } catch (e) {
    component = undefined;
  }
  return component;
}
