// tslint:disable:no-shadowed-variable

import * as PropTypes from "prop-types";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { Container, IPerspectiveStorage, ItemConfigType, Module, ModuleDrawer,
         ModuleTray, PerspectiveBar, PerspectiveBuilder, PerspectiveStorage,
         Workbench, WorkbenchBuilder } from "../../src/index";

// Note that React stateless components are currently not allowed in
// golden-layout as of 1.5.9. I have already submitted a pull request to
// address this issue:
//
// https://github.com/deepstreamIO/golden-layout/pull/334
//
// Until the PR is resolved, please use React classes only as root components
// in a golden-layout workbench.

// =============================================================================

interface IMyComponentProps {
  label: string;
}

class MyComponent extends React.Component<IMyComponentProps> {
  public render() {
    const { label } = this.props;
    return (
      <div className="panel">
        <div className="big-letter">{ label }</div>
      </div>
    );
  }
}

// =============================================================================

interface IHeaderProps {
  perspectives: IPerspectiveStorage;
  workbench: Workbench;
}

const Header = ({ perspectives, workbench }: IHeaderProps) => (
  <div style={{ display: "flex", alignItems: "center" }}>
    <div className="title">Workbench demo</div>
    <PerspectiveBar storage={perspectives} workbench={workbench} />
  </div>
);

// =============================================================================

interface IFooterProps {
  workbench: Workbench;
}

const Footer = ({ workbench }: IFooterProps) => (
  <div style={{ textAlign: "center" }}>
    <ModuleTray workbench={workbench}>
      <ModuleDrawer label="Generic">
        <Module id="panel-a" label="Panel A" component={MyComponent} props={{ label: "A" }} />
        <Module id="panel-b" label="Panel B" component={MyComponent} props={{ label: "B" }} />
        <Module id="panel-c" label="Panel C" component={MyComponent} props={{ label: "C" }} />
        <Module id="panel-d" label="Panel D" component={MyComponent} props={{ label: "D" }} />
      </ModuleDrawer>
      <ModuleDrawer label="Forecast">
      </ModuleDrawer>
      <ModuleDrawer label="Safety stock">
      </ModuleDrawer>
      <ModuleDrawer label="Import">
      </ModuleDrawer>
      <ModuleDrawer label="Master tables">
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
        .add(MyComponent, {
          props: { label: "C" },
          title: "Panel C",
        }, "panel-c")
      .finish()
      .add(MyComponent, {
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

// =============================================================================

workbench.render("#root");
ReactDOM.render(<Header perspectives={perspectives} workbench={workbench} />, $("#header").get(0));
ReactDOM.render(<Footer workbench={workbench} />, $("#footer").get(0));
