import { act, fireEvent, render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import WordGraphView from "../../components/connections/word-graph";
import { graph } from "../fixtures";
import type { WordGraph } from "../../lib/types";
const layout = vi.hoisted(() => ({
  nodes: [] as {
    id: string;
    endpoint: boolean;
    fx?: number | null;
    fy?: number | null;
    x: number;
    y: number;
  }[],
  stop: vi.fn(),
  restart: vi.fn(),
  distance: [] as number[],
}));
vi.mock("d3-force", () => ({
  forceSimulation: (nodes: typeof layout.nodes) => {
    layout.nodes = nodes;
    nodes.forEach((n, i) => {
      n.x = 100 + i * 120;
      n.y = 200;
    });
    const simulation = {
      force: vi.fn().mockReturnThis(),
      on: (_event: string, callback: () => void) => {
        callback();
        return simulation;
      },
      stop: layout.stop,
      alpha: () => simulation,
      restart: layout.restart,
    };
    return simulation;
  },
  forceLink: (
    links: {
      source: string | object;
      target: string | object;
      similarity: number;
    }[],
  ) => {
    const link = {
      id: (fn: (n: { id: string }) => string) => {
        layout.nodes.forEach(fn);
        links.forEach((l) => {
          l.source = layout.nodes.find((n) => n.id === l.source)!;
          l.target = layout.nodes.find((n) => n.id === l.target)!;
        });
        return link;
      },
      distance: (fn: (l: { similarity: number }) => number) => {
        layout.distance = links.map(fn);
        return link;
      },
      strength: () => link,
    };
    return link;
  },
  forceManyBody: () => ({ strength: vi.fn() }),
  forceCenter: vi.fn(),
  forceCollide: () => ({
    radius: (fn: (n: { endpoint: boolean }) => number) => layout.nodes.map(fn),
  }),
  forceX: () => ({ strength: vi.fn() }),
  forceY: () => ({ strength: vi.fn() }),
}));
function setup() {
  const onWord = vi.fn();
  const view = render(<WordGraphView graph={graph} onWord={onWord} />);
  const svg = view.container.querySelector("svg")!;
  Object.assign(svg, {
    setPointerCapture: vi.fn(),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: 340, y: 220 }),
    }),
  });
  const group = svg.querySelector("g")!;
  Object.assign(group, { getScreenCTM: () => ({ inverse: () => ({}) }) });
  return { ...view, svg, group, onWord };
}
it("uses embedding-derived target edge distances and correct edge labels", () => {
  const { container } = setup();
  expect(layout.distance).toEqual(
    graph.links.map((l) => 40 + (1 - l.similarity) * 240),
  );
  expect(container.querySelector("title")).toHaveTextContent("distance 0.100");
  expect(container.querySelectorAll("line")[2]).toHaveAttribute(
    "stroke-dasharray",
    "3 5",
  );
  expect(screen.getByText(/Select any word/)).toBeVisible();
});
it("supports selection, highlights neighbours and looks up the selected word", () => {
  const { container, onWord } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Inspect wave" }));
  expect(screen.getByText(/Appears in 1 paths/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Look up definition ↗" }));
  expect(onWord).toHaveBeenCalledWith("wave");
  expect(screen.getByText("Connection distances from wave")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Inspect unrelated" }),
  ).toHaveAttribute("opacity", "0.22");
  expect(container.querySelectorAll("line")[3]).toHaveAttribute(
    "opacity",
    "0.06",
  );
  fireEvent.click(screen.getByRole("button", { name: "Inspect ocean" }));
  expect(container.querySelectorAll("line")[0]).toHaveAttribute(
    "opacity",
    "0.6",
  );
  expect(container.querySelectorAll("line")[2]).toHaveAttribute(
    "opacity",
    "0.35",
  );
});
it("supports keyboard selection with Enter and Space while ignoring other keys", () => {
  setup();
  const node = screen.getByRole("button", { name: "Inspect sea" });
  fireEvent.keyDown(node, { key: "Escape" });
  expect(
    screen.queryByRole("button", { name: "Look up definition ↗" }),
  ).toBeNull();
  fireEvent.keyDown(node, { key: "Enter" });
  expect(screen.getByText("Connection distances from sea")).toBeVisible();
  fireEvent.keyDown(screen.getByRole("button", { name: "Inspect wave" }), {
    key: " ",
  });
  expect(screen.getByText("Connection distances from wave")).toBeVisible();
});
it("bounds zoom and resets it", () => {
  const { group } = setup();
  for (let i = 0; i < 20; i++)
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(group).toHaveAttribute(
    "transform",
    "translate(500 270) scale(3) translate(-500 -270)",
  );
  for (let i = 0; i < 20; i++)
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
  expect(group).toHaveAttribute(
    "transform",
    "translate(500 270) scale(0.4) translate(-500 -270)",
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(group).toHaveAttribute(
    "transform",
    "translate(500 270) scale(1) translate(-500 -270)",
  );
});
it("selects on pointer capture, transforms dragged coordinates and releases movable nodes", () => {
  const { svg } = setup();
  fireEvent.pointerMove(svg);
  fireEvent.pointerUp(svg);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Inspect wave" }), {
    pointerId: 1,
  });
  expect(screen.getByText("Connection distances from wave")).toBeVisible();
  fireEvent.pointerMove(svg, { clientX: 100, clientY: 50 });
  expect(layout.nodes.find((n) => n.id === "wave")).toMatchObject({
    fx: 340,
    fy: 220,
  });
  expect(layout.restart).toHaveBeenCalled();
  fireEvent.pointerUp(svg);
  expect(layout.nodes.find((n) => n.id === "wave")).toMatchObject({
    fx: null,
    fy: null,
  });
});
it("lets endpoint positions follow semantic forces and releases drag state on cancellation", () => {
  const { svg, group } = setup();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Inspect ocean" }), {
    pointerId: 1,
  });
  fireEvent.pointerUp(svg);
  expect(layout.nodes[0]).toMatchObject({ fx: null, fy: null });
  fireEvent.pointerDown(screen.getByRole("button", { name: "Inspect ocean" }));
  fireEvent.pointerCancel(svg);
  expect(layout.nodes[0].fx).toBeNull();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Inspect sea" }));
  Object.assign(group, { getScreenCTM: () => null });
  fireEvent.pointerMove(svg);
  expect(layout.nodes.find((n) => n.id === "sea")?.fx).toBeUndefined();
  fireEvent.pointerCancel(svg);
  expect(layout.nodes.find((n) => n.id === "sea")).toMatchObject({
    fx: null,
    fy: null,
  });
  fireEvent.pointerCancel(svg);
});
it("stops simulations on replacement and unmount, and resets selection", () => {
  const { rerender, unmount } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Inspect wave" }));
  const replacement: WordGraph = { ...graph, from: "music", to: "ocean" };
  act(() => rerender(<WordGraphView graph={replacement} onWord={vi.fn()} />));
  expect(layout.stop).toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Look up definition ↗" }),
  ).toBeNull();
  unmount();
  expect(layout.stop).toHaveBeenCalledTimes(2);
});
