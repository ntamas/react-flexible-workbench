// tslint:disable:no-shadowed-variable

import * as PropTypes from "prop-types";
import * as React from "react";
import * as ReactDOM from "react-dom";

import { Container, IPerspectiveStorage, ItemConfigType, Module, ModuleDrawer,
         ModuleTray, PerspectiveBar, PerspectiveBuilder, PerspectiveStorage,
         Workbench, WorkbenchBuilder, WorkbenchView } from "../../src/index";

import { MenuButton } from "./MenuButton";

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
  <div id="header" style={{ display: "flex", alignItems: "center" }}>
    <div className="title"></div>
    <PerspectiveBar storage={perspectives} workbench={workbench} />
  </div>
);

// =============================================================================

interface ISidebarButtonProps {
  isOpen?: boolean;
  onClick?: (event: React.SyntheticEvent<any>) => void;
  style?: React.CSSProperties;
}

const SidebarButton = ({ isOpen, onClick, style }: ISidebarButtonProps) => {
  return <MenuButton color="white" onClick={onClick} padding={14}
                     shape={isOpen ? "close" : "menu"} style={style} />;
};

interface ISidebarButtonControllerState {
  isOpen: boolean;
}

class SidebarButtonController extends React.Component<{}, ISidebarButtonControllerState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isOpen: false
    };
  }

  public render() {
    return (
      <SidebarButton onClick={toggleSidebar} isOpen={this.state.isOpen} />
    );
  }
}

// =============================================================================

interface ISidebarProps {
  children?: string | React.ReactNode | React.ReactNode[];
  isOpen?: boolean;
}

const Sidebar = ({ children, isOpen }: ISidebarProps) => {
  const classes = ["sidebar", isOpen ? "sidebar-open" : "sidebar-closed"];
  return (
    <div className={classes.join(" ")}>
      { isOpen ? children : null }
    </div>
  );
};

interface ISidebarControllerState {
  isOpen: boolean;
}

class SidebarController extends React.Component<{}, ISidebarControllerState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      isOpen: false
    };
  }

  public render() {
    return (
      <Sidebar isOpen={this.state.isOpen}>
        {this.props.children}
      </Sidebar>
    );
  }
}

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

let sidebarButton: SidebarButtonController;
let sidebar: SidebarController;
let sidebarVisible = false;

function setSidebarButton(value: any) {
  sidebarButton = value;
}

function setSidebar(value: any) {
  sidebar = value;
}

function toggleSidebar() {
  sidebarVisible = !sidebarVisible;
  sidebar.setState({
    isOpen: sidebarVisible
  }, () => {
    // This function gets rid of some minor flickering after the sidebar opens
    workbench.updateSize();
  });
  sidebarButton.setState({
    isOpen: sidebarVisible
  });
}

// =============================================================================

const App = () => {
  return (
    <div id="app">
      <div id="menu-button"><SidebarButtonController ref={setSidebarButton} /></div>
      <Header perspectives={perspectives} workbench={workbench} />
      <div id="main">
        <div id="sidebar-container">
          <SidebarController ref={setSidebar}>
            <h1>Workbench</h1>
            <ModuleTray allowMultipleSelection vertical workbench={workbench}>
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
          </SidebarController>
        </div>
        <div id="root-container">
          <WorkbenchView workbench={workbench} id="root" />
        </div>
      </div>
    </div>
  );
}
ReactDOM.render(<App />, document.getElementById("app-container"));
