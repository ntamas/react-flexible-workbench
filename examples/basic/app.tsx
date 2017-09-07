// tslint:disable:no-shadowed-variable

import * as React from "react";
import * as ReactDOM from "react-dom";

import { Container, Module, ModuleDrawer, ModuleTray,
         Workbench } from "../../src/index";

// Note that React stateless components are currently not allowed in
// golden-layout as of 1.5.9. I have already submitted a pull request to
// address this issue:
//
// https://github.com/deepstreamIO/golden-layout/pull/334
//
// Until the PR is resolved, please use React classes only as root components
// in a golden-layout workbench.

// =============================================================================

function PlainComponent(container: Container, state: { label: string }): void {
  container.getElement().html("<div class=\"big-letter\">" + state.label + "</div>");
}

interface IMyComponentProps {
  label: string;
}

class MyComponent extends React.Component<IMyComponentProps> {
  public render() {
    const { label } = this.props;
    return (
      <div className="big-letter">{ label }</div>
    );
  }
}

// =============================================================================

interface IHeaderProps {
  workbench: Workbench;
}

const Header = ({ workbench }: IHeaderProps) => (
  <div style={{ display: "flex", alignItems: "center" }}>
    <div className="title">Workbench demo</div>
    <div className="button-bar">
      <button onClick={() => console.log(workbench.getState())}>Save</button>
    </div>
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
        <Module label="Panel A" />
        <Module label="Panel B" />
        <Module label="Panel C" />
        <Module label="Panel D" />
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

const workbench = new Workbench.Builder()
  .register("plain", PlainComponent)
  .makeRows()
    .add(MyComponent, {
      props: { label: "A" },
      title: "Panel A",
    })
    .setRelativeHeight(66)
    .makeColumns()
      .makeStack()
        .add(MyComponent, {
          props: { label: "B" },
          title: "Panel B",
        })
        .add("plain", {
          state: { label: "C" },
          title: "Panel C",
        })
      .finish()
      .add(MyComponent, {
        props: { label: "D" },
        title: "Panel D",
      })
  .build();

// =============================================================================

workbench.render("#root");
ReactDOM.render(<Header workbench={workbench} />, $("#header").get(0));
ReactDOM.render(<Footer workbench={workbench} />, $("#footer").get(0));
