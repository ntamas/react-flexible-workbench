import * as React from "react";

export function getDisplayName(component: React.ReactType): string | undefined {
  return (typeof component === "string") ? (
    component.length > 0 ? component : undefined
  ) : (
    component.displayName || component.name || undefined
  );
}
