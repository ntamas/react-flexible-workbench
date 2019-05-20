// tslint:disable:no-shadowed-variable

import * as React from "react";
import * as ReactDOM from "react-dom";
import { BarLoader } from "react-spinners";

import * as iterators from "../../src/iterators";

import {
  Module, ModuleDrawer,
  ModuleTray, PerspectiveBuilder, PerspectiveStorage,
  Workbench, WorkbenchBuilder, WorkbenchView
} from "../../src/index";

import { Header, MyComponent, MyStatefulComponent } from "../common";

const delay = require("delay");

require("../../themes/blue.css");

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
        <Module id="panel-c" label="Panel C" component={MyComponent} props={{ label: "C" }} />
        <Module id="panel-d" label="Panel D" component={MyComponent} props={{ label: "D" }} />
      </ModuleDrawer>
      <ModuleDrawer label="Forecast" id="forecast">
        <Module label="Panel E" component={MyComponent} props={{
          button: <button>Duplicate</button>,
          label: "E"
        }} />
      </ModuleDrawer>
      <ModuleDrawer label="Safety stock" id="safety-stock">
      </ModuleDrawer>
      <ModuleDrawer label="Import" id="import">
      </ModuleDrawer>
      <ModuleDrawer label="Master tables" id="master-tables">
      </ModuleDrawer>
    </ModuleTray>
  </div>
);

// =============================================================================

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
        .add(MyStatefulComponent, {
          props: { label: "C" },
          title: "Panel C",
        }, "panel-c")
      .finish()
      .add(MyStatefulComponent, {
        props: { label: "D" },
        title: "Panel D",
      }, "panel-d")
  .build();

const perspectives = PerspectiveStorage.fromArray([
  {
    label: "P1",
    state: {
      content:
        new PerspectiveBuilder(workbench)
          .makeRows()
            .add(MyComponent, {
              props: { label: "A" },
              title: "Panel A"
            }, "panel-a")
            .add(MyComponent, {
              props: { label: "B" },
              title: "Panel B"
            }, "panel-b")
          .build()
    }
  },
  {
    label: "P2",
    state: {
      content:
        new PerspectiveBuilder(workbench)
          .makeColumns()
            .add(MyComponent, {
              props: { label: "A" },
              title: "Panel A"
            }, "panel-a")
            .add(MyComponent, {
              props: { label: "B" },
              title: "Panel B"
            }, "panel-b")
          .build()
    }
  }
]);

// Simulate delays in the perspective loading process
const oldForEach: any = perspectives.forEach.bind(perspectives);
perspectives.forEach = ((...args: any[]) => {
  return delay(2000).then(() => oldForEach(...args));
}) as any;

// =============================================================================

const App = () => (
  <div id="app">
    <Header perspectives={perspectives} workbench={workbench} fallback={<BarLoader color="#8ce" />} />
    <WorkbenchView id="root" workbench={workbench} />
    <Footer workbench={workbench} />
  </div>
);

ReactDOM.render(
  <React.StrictMode><App /></React.StrictMode>,
  document.getElementById("app-container")
);

(window as any).workbench = workbench;
(window as any).iterators = iterators;
console.log("window.workbench now points to the main workbench object.");
