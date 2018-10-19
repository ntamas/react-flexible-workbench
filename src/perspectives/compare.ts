import { IWorkbenchState } from "../types";

/**
 * Compares two workbench state objects and returns whether they are identical,
 * ignoring changes in selected tabs of stacks.
 *
 * @param  {WorkbenchState}  foo  the first state
 * @param  {WorkbenchState}  bar  the second state
 * @return {boolean}  true if the two states are equal or differ only in the
 *         selected tabs, false otherwise
 */
export function areWorkbenchStatesEqualIgnoringSelection(
  foo: IWorkbenchState, bar: IWorkbenchState
): boolean {
  return compareHelper(foo, bar);
}

function compareHelper(foo: any, bar: any): boolean {
  if (foo === bar) {
    return true;
  } else if (foo instanceof Date && bar instanceof Date) {
    return foo.getTime() === bar.getTime();
  } else if (!foo || !bar || typeof foo !== "object" || typeof bar !== "object") {
    return foo === bar;
  } else {
    return compareObjects(foo, bar);
  }
}

function isBuffer(x: any) {
  if (!x || typeof x !== "object" || typeof x.length !== "number") {
    return false;
  }
  if (typeof x.copy !== "function" || typeof x.slice !== "function") {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== "number") {
    return false;
  }
  return true;
}

function isNil(obj: any): boolean {
  return obj === undefined || obj === null;
}

interface ISavedStateDefaults {
  header: any;
  isClosable: boolean;
  reorderEnabled: boolean;
  title: string;
}

const defaults: ISavedStateDefaults = {
  header: {},
  isClosable: true,
  reorderEnabled: true,
  title: ""
};

function compareObjects(foo: any, bar: any): boolean {
  let i;

  if (isNil(foo) || isNil(bar)) {
    return false;
  }
  if (foo.prototype !== bar.prototype) {
    return false;
  }
  if (isBuffer(foo)) {
    if (!isBuffer(bar)) {
      return false;
    }
    if (foo.length !== bar.length) {
      return false;
    }
    for (i = 0; i < foo.length; i++) {
      if (foo[i] !== bar[i]) {
        return false;
      }
    }
    return true;
  }

  // golden-layout wraps components in single-item stacks if they are
  // standing on their own in a row or column. We ignore these differences
  // when comparing states.
  if (isStackWithSingleItem(foo)) {
    if (!isStackWithSingleItem(bar)) {
      return compareObjects(foo.content[0], bar);
    }
  } else if (isStackWithSingleItem(bar)) {
    return compareObjects(foo, bar.content[0]);
  }

  let fooKeys: string[];
  let barKeys: string[];

  try {
    fooKeys = Object.keys(foo).filter(acceptsKey);
    barKeys = Object.keys(bar).filter(acceptsKey);
  } catch (e) {
    return false;
  }

  // Ignore keys that are set to their default values in foo and bar
  if (!Array.isArray(foo) && !Array.isArray(bar)) {
    Object.keys(defaults).forEach((key: keyof ISavedStateDefaults) => {
      if (foo.hasOwnProperty(key) && compareHelper(foo[key], defaults[key])) {
        fooKeys.splice(fooKeys.indexOf(key), 1);
      }
      if (bar.hasOwnProperty(key) && compareHelper(bar[key], defaults[key])) {
        barKeys.splice(barKeys.indexOf(key), 1);
      }
    });
  }

  if (fooKeys.length !== barKeys.length) {
    return false;
  }

  fooKeys.sort();
  barKeys.sort();

  for (i = fooKeys.length - 1; i >= 0; i--) {
    if (fooKeys[i] !== barKeys[i]) {
      return false;
    }
  }

  for (i = fooKeys.length - 1; i >= 0; i--) {
    const key: string = fooKeys[i];
    if (!compareHelper(foo[key], bar[key])) {
      return false;
    }
  }

  return typeof foo === typeof bar;
}

function acceptsKey(key: string): boolean {
  return key !== "activeItemIndex";
}

function isStackWithSingleItem(obj: any): boolean {
  return (
    obj.hasOwnProperty("type") && obj.type === "stack" &&
    obj.hasOwnProperty("content") && Array.isArray(obj.content) &&
    obj.content.length === 1
  );
}
