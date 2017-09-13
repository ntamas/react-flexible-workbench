import * as GoldenLayout from "golden-layout";
import * as React from "react";

export function getDisplayName(component: React.ReactType): string | undefined {
  return (typeof component === "string") ? (
    component.length > 0 ? component : undefined
  ) : (
    component.displayName || component.name || undefined
  );
}

export function isElementClassEqualTo<P>(
  cls: React.ComponentClass<P>, element: React.ReactElement<any> | React.ReactText | undefined
): element is React.ReactElement<P> {
  if (element === undefined ||
      typeof element === "string" || typeof element === "number") {
    return false;
  }
  if (element.hasOwnProperty("props") &&
      element.hasOwnProperty("type") && element.type === cls) {
      return true;
  } else {
    return false;
  }
}

export function traverseWorkbench(
  tree: GoldenLayout.Config,
  func: (item: GoldenLayout.ItemConfigType) => boolean
): void {
  if (tree.content !== undefined) {
    tree.content.forEach(branch => traverseWorkbenchBranch(branch, func));
  }
}

export function traverseWorkbenchBranch(
  branch: GoldenLayout.ItemConfigType,
  func: (item: GoldenLayout.ItemConfigType) => boolean
): void {
  const queue = [branch];
  while (queue.length > 0) {
    const node = queue.pop();
    if (node !== undefined && func(node)) {
      if (node.hasOwnProperty("content") && node.content !== undefined) {
        queue.push(...node.content);
      }
    }
  }
}
