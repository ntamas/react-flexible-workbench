// tslint:disable:no-shadowed-variable

import * as React from "react";

import {
  IPerspectiveStorage, PerspectiveBar, Workbench
} from "../src/index";

// =============================================================================

interface IMyComponentProps {
  label: string;
  message?: string;
  button?: React.ReactNode;
}

interface IMyComponentState {
  counter: number;
}

export const MyComponent = ({ button, label, message }: IMyComponentProps) => (
  <div className="panel">
    <div className="big-letter">{ label }</div>
    { message ? <div>{message}</div> : null}
    { button }
  </div>
);
(MyComponent as any).displayName = "MyComponent";

export class MyStatefulComponent extends React.Component<IMyComponentProps, IMyComponentState> {
  constructor(props: IMyComponentProps) {
    super(props);
    this.state = {
      counter: 0
    };
    this._onClick = this._onClick.bind(this);
  }

  public render() {
    return (
      <div className="panel" onClick={this._onClick} style={{ cursor: "pointer" }}>
        <div className="big-letter">{ this.props.label }{ this.state.counter }</div>
      </div>
    );
  }

  private _onClick() {
    this.setState({
      counter: (this.state.counter + 1) % 10
    });
  }
}

// =============================================================================

interface IHeaderProps {
  fallback?: React.ReactNode;
  perspectives?: IPerspectiveStorage;
  title?: string;
  workbench?: Workbench;
}

export const Header = ({ fallback, perspectives, title, workbench }: IHeaderProps) => (
  <div id="header" style={{ display: "flex", alignItems: "center" }}>
    <div className="title">{title || "Workbench demo"}</div>
    { (perspectives && workbench) ? (
      <PerspectiveBar storage={perspectives} workbench={workbench} fallback={fallback} />
    ) : null}
  </div>
);
