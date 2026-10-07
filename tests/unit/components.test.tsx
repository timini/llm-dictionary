import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { it, expect, vi } from "vitest";
import SearchForm from "../../components/explorer/search-form";
import ModeTabs from "../../components/explorer/mode-tabs";
import LoadingState from "../../components/explorer/loading-state";
import EmptyState from "../../components/explorer/empty-state";
import DefinitionEntry from "../../components/dictionary/definition-entry";
import ConnectionResult from "../../components/connections/connection-result";
import NeighbourDistances from "../../components/connections/neighbour-distances";
import Explorer from "../../components/explorer/explorer";
import Page from "../../app/page";
import Layout, { metadata } from "../../app/layout";
import { definition, graph } from "../fixtures";
import type { useExplorer } from "../../hooks/use-explorer";
const mock = vi.hoisted(() => ({ hook: vi.fn() }));
vi.mock("../../hooks/use-explorer", () => ({ useExplorer: mock.hook }));
vi.mock("../../components/connections/word-graph", () => ({
  default: () => <div>Interactive graph</div>,
}));
function explorerState(
  overrides: Partial<ReturnType<typeof useExplorer>> = {},
) {
  return {
    mode: "dictionary" as const,
    word: "",
    from: "",
    to: "",
    definition: null,
    graph: null,
    busy: false,
    progress: "",
    error: "",
    cached: false,
    setWord: vi.fn(),
    setFrom: vi.fn(),
    setTo: vi.fn(),
    define: vi.fn(),
    connect: vi.fn(),
    stop: vi.fn(),
    changeMode: vi.fn(),
    ...overrides,
  };
}
it("submits dictionary inputs and suggestions through component callbacks", () => {
  const state = explorerState();
  const { container } = render(
    <SearchForm {...state} onDefine={state.define} onConnect={state.connect} />,
  );
  fireEvent.change(screen.getByLabelText("Word to define"), {
    target: { value: "ocean" },
  });
  expect(state.setWord).toHaveBeenCalledWith("ocean");
  fireEvent.submit(container.querySelector("form")!);
  expect(state.define).toHaveBeenCalledWith("");
  fireEvent.click(screen.getByRole("button", { name: "serendipity ↗" }));
  expect(state.define).toHaveBeenCalledWith("serendipity");
  expect(screen.getByLabelText("Word to define")).toHaveAttribute(
    "maxlength",
    "60",
  );
});
it("submits connection pairs, handles both inputs and disables searches while busy", () => {
  const state = explorerState({
    mode: "connections",
    from: "ocean",
    to: "music",
  });
  const { container, rerender } = render(
    <SearchForm {...state} onDefine={state.define} onConnect={state.connect} />,
  );
  fireEvent.change(screen.getByLabelText("Starting word"), {
    target: { value: "coffee" },
  });
  fireEvent.change(screen.getByLabelText("Destination word"), {
    target: { value: "space" },
  });
  expect(state.setFrom).toHaveBeenCalledWith("coffee");
  expect(state.setTo).toHaveBeenCalledWith("space");
  fireEvent.submit(container.querySelector("form")!);
  expect(state.connect).toHaveBeenCalledWith("ocean", "music");
  fireEvent.click(screen.getByRole("button", { name: "coffee → space" }));
  expect(state.connect).toHaveBeenCalledWith("coffee", "space");
  rerender(
    <SearchForm
      {...state}
      busy
      onDefine={state.define}
      onConnect={state.connect}
    />,
  );
  expect(screen.getByRole("button", { name: "Exploring… ↗" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "ocean → music" })).toBeDisabled();
});
it("switches both modes and explains empty and loading states", () => {
  const onChange = vi.fn(),
    onStop = vi.fn();
  const { rerender } = render(
    <ModeTabs mode="dictionary" onChange={onChange} />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "02 Word connections ↗" }),
  );
  expect(onChange).toHaveBeenCalledWith("connections");
  rerender(<ModeTabs mode="connections" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "01 Dictionary" }));
  expect(onChange).toHaveBeenCalledWith("dictionary");
  rerender(<EmptyState mode="dictionary" />);
  expect(screen.getByText("Every word has a story.")).toBeVisible();
  rerender(<EmptyState mode="connections" />);
  expect(
    screen.getByText("There’s a connection waiting to be found."),
  ).toBeVisible();
  rerender(
    <LoadingState mode="dictionary" progress="Defining" onStop={onStop} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  expect(onStop).toHaveBeenCalledOnce();
  rerender(
    <LoadingState mode="connections" progress="Embedding" onStop={onStop} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent("Embedding");
});
it("renders dictionary senses, origins, optional notes and clickable synonyms", () => {
  const onWord = vi.fn();
  const { rerender } = render(
    <DefinitionEntry definition={definition} cached onWord={onWord} />,
  );
  expect(screen.getByText("↺ Saved result")).toBeVisible();
  expect(screen.getByText("WORD ORIGIN")).toBeVisible();
  expect(screen.getByText("A large body of salt water.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "sea ↗" }));
  expect(onWord).toHaveBeenCalledWith("sea");
  rerender(
    <DefinitionEntry
      definition={{ ...definition, origin: "", note: "An interpretation" }}
      cached={false}
      onWord={onWord}
    />,
  );
  expect(screen.queryByText("WORD ORIGIN")).not.toBeInTheDocument();
  expect(screen.getByText("An interpretation")).toBeVisible();
  expect(screen.getByText("✧ Newly explored")).toBeVisible();
});
it("renders graph paths and allows definition navigation for every path word", () => {
  const onWord = vi.fn();
  const { rerender } = render(
    <ConnectionResult graph={graph} cached onWord={onWord} />,
  );
  expect(screen.getByText("↺ Saved result")).toBeVisible();
  fireEvent.click(screen.getAllByRole("button", { name: "ocean" })[0]);
  expect(onWord).toHaveBeenCalledWith("ocean");
  expect(screen.getByText(/Edge lengths use cosine distance/)).toBeVisible();
  rerender(<ConnectionResult graph={graph} cached={false} onWord={onWord} />);
  expect(screen.getByText("✧ Newly explored")).toBeVisible();
});
it("sorts neighbours by distance regardless of source/target orientation", () => {
  const { container } = render(
    <NeighbourDistances selected="wave" links={graph.links} />,
  );
  expect(
    [...container.querySelectorAll("li")].map((li) => li.textContent),
  ).toEqual(["ocean0.100", "music0.700"]);
});
it("composes empty, loading, error, definition, and graph states", () => {
  mock.hook.mockReturnValue(explorerState());
  const { rerender } = render(<Explorer />);
  expect(screen.getByText("Every word has a story.")).toBeVisible();
  mock.hook.mockReturnValue(explorerState({ busy: true, progress: "Working" }));
  rerender(<Explorer />);
  expect(screen.getByRole("status")).toHaveTextContent("Working");
  mock.hook.mockReturnValue(explorerState({ error: "Quota" }));
  rerender(<Explorer />);
  expect(screen.getByRole("alert")).toHaveTextContent("Quota");
  mock.hook.mockReturnValue(explorerState({ definition }));
  rerender(<Explorer />);
  expect(screen.getByRole("heading", { name: "ocean" })).toBeVisible();
  mock.hook.mockReturnValue(explorerState({ mode: "connections" }));
  rerender(<Explorer />);
  expect(
    screen.getByText("There’s a connection waiting to be found."),
  ).toBeVisible();
  mock.hook.mockReturnValue(explorerState({ mode: "connections", graph }));
  rerender(<Explorer />);
  expect(screen.getByRole("heading", { name: "ocean ⟷ music" })).toBeVisible();
});
it("composes the page and document metadata", () => {
  mock.hook.mockReturnValue(explorerState());
  render(<Page />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "A word is just",
  );
  expect(metadata.title).toContain("LLM Dictionary");
  expect(metadata.icons).toEqual({ icon: "/favicon.svg" });
  expect(
    renderToStaticMarkup(
      <Layout>
        <p>Child content</p>
      </Layout>,
    ),
  ).toContain(
    '<html lang="en"><head></head><body><p>Child content</p></body></html>',
  );
});
