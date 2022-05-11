// tslint:disable:no-shadowed-variable

import * as React from "react";
import { createRoot } from "react-dom/client";

import { Header, MyComponent } from "../common";

import {
  Module, ModuleDrawer, ModuleTray, Workbench, WorkbenchBuilder,
  WorkbenchView
} from "../../src/index";

require("../../themes/blue.css");

// =============================================================================

interface IFallbackComponentProps {
  message?: string;
}

const FallbackComponent = ({ message }: IFallbackComponentProps) => (
  <div className="panel">
    <div className="big-letter">?</div>
    <div>{message || "No such component. We have handled this gracefully."}</div>
  </div>
);

// =============================================================================

interface IFooterProps {
  workbench: Workbench;
}

const Footer = ({ workbench }: IFooterProps) => (
  <div id="footer">
    <ModuleTray workbench={workbench}>
      <ModuleDrawer label="Generic" id="generic">
        <Module id="panel-a" label="Panel A" component={MyComponent} props={{ label: "A" }} />
        <Module id="panel-b" label="Panel B" component={MyComponent} props={{ label: "B" }} />
      </ModuleDrawer>
    </ModuleTray>
  </div>
);

// =============================================================================

const workbench = new WorkbenchBuilder()
  .makeRows()
    .add("lm-react-component", {
      props: { label: "A" },
      title: "Missing panel 1",
    }, "panel-x")
    .setRelativeHeight(66)
    .makeColumns()
      .makeStack()
        .add(MyComponent, {
          props: { label: "B" },
          title: "Panel B",
        }, "panel-b")
        .add("lm-react-component", {
          props: { label: "C" },
          title: "Missing panel 2",
        }, "panel-c")
      .finish()
  .build();

workbench.fallback = () => <FallbackComponent />;

// =============================================================================

const App = () => (
  <div id="app">
    <Header title="Missing panels demo" />
    <WorkbenchView id="root" workbench={workbench} />
    <Footer workbench={workbench} />
  </div>
);

const container = document.getElementById("app-container")!;
const root = createRoot(container);
root.render(
  <React.StrictMode><App /></React.StrictMode>,
);
