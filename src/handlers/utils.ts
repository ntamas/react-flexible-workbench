import * as GoldenLayout from "golden-layout";

import { ReactComponentHandler } from "./base";
import { ComponentFactory } from "./types";

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

/**
 * Helper function that takes a component handler class and returns another
 * class that behaves the same way as the original one but uses a fallback
 * component factory if the original handler cannot create the component to
 * be rendered.
 *
 * @param  handler the original component handler to wrap
 * @param  factory fallback component factory that returns the React element
 *         to render when the original handler cannot handle the component.
 * @return         [description]
 */
export function createHandlerWithFallback(
  handler: { new (...args: any[]): ReactComponentHandler },
  fallback: (componentName: string) => ComponentFactory | undefined
): { new (...args: any[]): ReactComponentHandler } {
  return class FallbackComponentHandler extends handler {
    protected handleComponentCreationFailure(componentName: string) {
      return fallback(componentName);
    }
  };
}
