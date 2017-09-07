import * as GoldenLayout from "golden-layout";

export type ComponentConstructor<TState> =
  (node: GoldenLayout.Container, state: TState) => void;

export type DragSource = any;
