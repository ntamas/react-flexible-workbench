// tslint:disable:no-shadowed-variable

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Header } from "../common";

import {
  ItemConfigType, WorkbenchBuilder, WorkbenchView
} from "../../src/index";

require("../../themes/blue.css");

// =============================================================================

interface IMyComponentProps {
  label: string;
  hidden?: boolean;
  message?: string;
  button?: React.ReactNode;
}

const MyComponent = ({ button, label, message }: IMyComponentProps) => (
  <div className="panel">
    <div className="big-letter">{ label }</div>
    { message ? <div>{message}</div> : null}
    { button }
  </div>
);

// =============================================================================

interface IFallbackComponentProps {
  message?: string;
}

const FallbackComponent = ({ message }: IFallbackComponentProps) => (
  <div className="panel">
    <div className="big-letter">!!!</div>
    <div>{message || "You have no permissions to see this panel."}</div>
  </div>
);

// =============================================================================

const hasPermissionsFor = (item: ItemConfigType) =>
  item.hasOwnProperty("props") && (item as any).props.label !== "B";

const workbench = new WorkbenchBuilder()
  .makeRows()
    .add(MyComponent, {
      props: { label: "A" },
      title: "Panel A",
    }, "panel-a")
    .setRelativeHeight(66)
    .makeColumns()
      .makeStack()
        .add(MyComponent, {
          props: { label: "B" },
          title: "Panel B",
        }, "panel-b")
        .add(MyComponent, {
          props: { label: "C" },
          title: "Panel C",
        }, "panel-c")
        .add(MyComponent, {
          props: { label: "D", hidden: true },
          title: "Panel D",
        }, "panel-d")
  .mapPanels(item => hasPermissionsFor(item) ? item : {
    ...item,
    component: "FallbackComponent",
    title: `${item.title} (permission denied)`
  })
  .filterPanels(
    item => item.hasOwnProperty("props") && !(item as any).props.hidden
  )
  .build();

workbench.fallback = () => <FallbackComponent />;

// =============================================================================

const App = () => (
  <div id="app">
    <Header title="Configuration transformation demo" />
    <WorkbenchView id="root" workbench={workbench} />
  </div>
);

ReactDOM.render(
  <React.StrictMode><App /></React.StrictMode>,
  document.getElementById("app-container")
);
