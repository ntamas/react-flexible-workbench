import * as React from "react";

// <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>

const style: React.CSSProperties = {
  display: "inline-block",
  height: 24,
  userSelect: "none",
  width: 24
};

interface ISvgIconProps {
  children: React.ReactNode;
}

const SvgIcon = ({ children }: ISvgIconProps) => (
  <svg viewBox="0 0 24 24" style={style}>{children}</svg>
);

const makeIcon = (path: string) => (
  () => (
    <SvgIcon>
      <path d={path} fill="currentColor" />
    </SvgIcon>
  )
);

export const Chart = makeIcon(
  "M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
);

export const Generic = makeIcon(
  "M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"
);

export const Import = makeIcon(
  "M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"
);

export const Storage = makeIcon(
  "M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z"
);

export const Table = makeIcon(
  "M4 14h4v-4H4v4zm0 5h4v-4H4v4zM4 9h4V5H4v4zm5 5h12v-4H9v4zm0 5h12v-4H9v4zM9 5v4h12V5H9z"
);
