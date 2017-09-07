/* tslint:disable:interface-name */

// javascript-detect-element-resize adds these
interface Window {
  addResizeListener(element: any, callback: (event: Event) => void): void;
}
