// tslint:disable:no-shadowed-variable

import * as React from "react";
import Badge from "react-badger";
import * as ReactDOM from "react-dom";
import Shapeshifter from "react-shapeshifter";

import * as icons from "./icons";

import {
  IPerspectiveStorage, Module, ModuleDrawer, ModuleTray, PerspectiveBar,
  PerspectiveBuilder, PerspectiveStorage, Workbench, WorkbenchBuilder,
  WorkbenchView
} from "../../src/index";

require("../../themes/dark.css");

// =============================================================================

interface IMyComponentProps {
  label: string;
}

const MyComponent = ({ label }: IMyComponentProps) => (
  <div className="panel">
    <div className="big-letter">{ label }</div>
  </div>
);

// =============================================================================

interface IHeaderProps {
  perspectives: IPerspectiveStorage;
  workbench: Workbench;
}

const Header = ({ perspectives, workbench }: IHeaderProps) => (
  <div id="header" style={{ display: "flex", alignItems: "center" }}>
    <div className="title"></div>
    <PerspectiveBar storage={perspectives} workbench={workbench} />
  </div>
);

// =============================================================================

interface ISidebarButtonProps {
  open?: boolean;
  onClick?: (event: React.SyntheticEvent<any>) => void;
}

const SidebarButton = ({ open, onClick }: ISidebarButtonProps) => (
  <div id="menu-button">
    <Shapeshifter color="white" onClick={onClick} shape={open ? "close" : "menu"} />
  </div>
);

// =============================================================================

interface ISidebarProps {
  children?: string | React.ReactNode | React.ReactNode[];
  open?: boolean;
}

const Sidebar = ({ children, open }: ISidebarProps) => {
  const classes = ["sidebar", open ? "sidebar-open" : "sidebar-closed"];
  return (
    <div className={classes.join(" ")}>
      { open ? children : null }
    </div>
  );
};

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
            .makeStack()
              .add(MyComponent, {
                props: { label: "B" },
                title: "Panel B"
              }, "panel-b")
              .add(MyComponent, {
                props: { label: "C" },
                title: "Panel C"
              }, "panel-c")
            .finish()
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

interface IAppState {
  sidebarOpen: boolean;
}

class App extends React.Component<{}, IAppState> {

  constructor(props: {}) {
    super(props);
    this.state = {
      sidebarOpen: false
    };
  }

  public render() {
    const { sidebarOpen } = this.state;
    return (
      <div id="app">
        <SidebarButton open={sidebarOpen} onClick={this.toggleSidebar} />
        <Header perspectives={perspectives} workbench={workbench} />

        <div id="main">
          <div id="sidebar-container">
            <Sidebar open={sidebarOpen}>
              <h1>Workbench</h1>
              <ModuleTray allowMultipleSelection vertical workbench={workbench}>
                <ModuleDrawer id="generic" icon={<icons.Generic />} label="Generic">
                  <Module id="panel-a" label="Panel A" component={MyComponent} props={{ label: "A" }} />
                  <Module id="panel-b" label="Panel B" component={MyComponent} props={{ label: "B" }} />
                  <Module id="panel-c" label="Panel C" component={MyComponent} props={{ label: "C" }} />
                  <Module id="panel-d" label="Panel D" component={MyComponent} props={{ label: "D" }} />
                </ModuleDrawer>
                <ModuleDrawer id="forecase" icon={<icons.Chart />} label="Forecast">
                </ModuleDrawer>
                <ModuleDrawer id="safety-stock" icon={<icons.Storage />} label="Safety stock">
                </ModuleDrawer>
                <ModuleDrawer id="import" badge={<Badge />} icon={<icons.Import />} label="Import">
                </ModuleDrawer>
                <ModuleDrawer id="master-tables" icon={<icons.Table />} label="Master tables">
                </ModuleDrawer>
              </ModuleTray>
            </Sidebar>
          </div>
          <div id="root-container">
            <WorkbenchView workbench={workbench} id="root" />
          </div>
        </div>
      </div>
    );
  }

  public toggleSidebar = () => {
    const { sidebarOpen } = this.state;
    this.setState({
      sidebarOpen: !sidebarOpen
    }, () => {
      // This function gets rid of some minor flickering after the sidebar opens
      workbench.updateSize();
    });
  }

}

ReactDOM.render(
  <React.StrictMode><App /></React.StrictMode>,
  document.getElementById("app-container")
);
