import * as GoldenLayout from "golden-layout";

export type ComponentConstructor<TState> =
  (node: GoldenLayout.Container, state: TState) => void;

export type Container = GoldenLayout.Container;
export type DragSource = any;
export type ItemConfigType = GoldenLayout.ItemConfigType;
