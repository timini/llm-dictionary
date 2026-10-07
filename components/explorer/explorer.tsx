"use client";
import { useExplorer } from "../../hooks/use-explorer";
import ConnectionResult from "../connections/connection-result";
import DefinitionEntry from "../dictionary/definition-entry";
import EmptyState from "./empty-state";
import LoadingState from "./loading-state";
import ModeTabs from "./mode-tabs";
import SearchForm from "./search-form";
export default function Explorer() {
  const state = useExplorer();
  const { mode, busy, error, definition, graph } = state;
  const result = mode === "dictionary" ? definition : graph;
  return (
    <section className="workspace" aria-label="Dictionary explorer">
      <ModeTabs mode={mode} onChange={state.changeMode} />
      <SearchForm
        {...state}
        onDefine={state.define}
        onConnect={state.connect}
      />
      {busy ? (
        <LoadingState
          mode={mode}
          progress={state.progress}
          onStop={state.stop}
        />
      ) : error ? (
        <div className="error" role="alert">
          {error}
          <span>Completed steps are saved. Submit again to retry.</span>
        </div>
      ) : !result ? (
        <EmptyState mode={mode} />
      ) : mode === "dictionary" ? (
        <DefinitionEntry
          definition={definition!}
          cached={state.cached}
          onWord={state.define}
        />
      ) : (
        <ConnectionResult
          graph={graph!}
          cached={state.cached}
          onWord={state.define}
        />
      )}
    </section>
  );
}
