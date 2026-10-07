'use client';
import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Definition, JobResponse, WordGraph } from '../lib/types';
const Graph = dynamic(() => import('../components/word-graph'), { ssr: false, loading: () => <div className="empty-result">Arranging words…</div> });
export default function Page() {
  const [mode, setMode] = useState<'dictionary' | 'connections'>('dictionary');
  const [word, setWord] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [definition, setDefinition] = useState<Definition | null>(null); const [graph, setGraph] = useState<WordGraph | null>(null);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(''); const [error, setError] = useState(''); const [cached, setCached] = useState(false);
  const controller = useRef<AbortController | null>(null);
  async function request(url: string, body: unknown, signal: AbortSignal) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Unable to complete this request.'); return data;
  }
  async function define(value: string) {
    controller.current?.abort(); const ctrl = new AbortController(); controller.current = ctrl;
    setMode('dictionary'); setWord(value); setBusy(true); setError(''); setProgress('Finding the meaning…'); setDefinition(null);
    try { const result = await request('/api/dictionary', { word: value }, ctrl.signal); setDefinition(result.data); setCached(result.cached); }
    catch (err) { if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { if (!ctrl.signal.aborted) setBusy(false); }
  }
  async function connect(a: string, b: string) {
    controller.current?.abort(); const ctrl = new AbortController(); controller.current = ctrl;
    setFrom(a); setTo(b); setBusy(true); setError(''); setGraph(null); setProgress('Starting the first association paths…');
    try {
      for (let i = 0; i < 100; i++) {
        const result: JobResponse = await request('/api/connections', { from: a, to: b }, ctrl.signal);
        if (result.status === 'complete') { setGraph(result.data); setCached(result.cached); return; }
        setProgress(result.stage);
        await new Promise<void>((resolve, reject) => { const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }; const timer = setTimeout(() => { ctrl.signal.removeEventListener('abort', abort); resolve(); }, 6500); ctrl.signal.addEventListener('abort', abort, { once: true }); });
      }
      throw new Error('This graph is taking longer than expected. Try again to continue from saved progress.');
    } catch (err) { if (!ctrl.signal.aborted) setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { if (!ctrl.signal.aborted) setBusy(false); }
  }
  function changeMode(value: typeof mode) { controller.current?.abort(); setBusy(false); setError(''); setMode(value); }
  return <main>
    <header className="site-header"><a href="/" className="brand"><span className="brand-icon">ll</span> llm dictionary<span className="edition">An experiment in language</span></a><span className="header-note">Words have more to say.</span></header>
    <section className="intro"><div className="eyebrow">MEANING / ASSOCIATION / DISCOVERY</div><h1>A word is just<br/>the <em>beginning.</em></h1><p>Find its meaning. Follow its connections.<br/>See where language takes you.</p><span className="intro-index">Aa<span>01 — ∞</span></span></section>
    <section className="workspace" aria-label="Dictionary explorer">
      <nav className="tabs" aria-label="Explorer mode"><button className={mode === 'dictionary' ? 'active' : ''} onClick={() => changeMode('dictionary')}><span>01</span> Dictionary</button><button className={mode === 'connections' ? 'active' : ''} onClick={() => changeMode('connections')}><span>02</span> Word connections <i>↗</i></button></nav>
      <div className="search-area"><div className="search-heading"><h2>{mode === 'dictionary' ? 'What’s the word?' : 'How do two words connect?'}</h2><span>{mode === 'dictionary' ? 'A little curiosity goes a long way.' : '100 paths. Many ways to get there.'}</span></div>
        <form onSubmit={e => { e.preventDefault(); if (mode === 'dictionary') void define(word); else void connect(from, to); }} className="search-form">
          {mode === 'dictionary' ? <label><span className="sr-only">Word to define</span><input value={word} onChange={e => setWord(e.target.value)} placeholder="Enter any word or short phrase…" required maxLength={60} autoComplete="off"/></label> : <><label><span className="sr-only">Starting word</span><input value={from} onChange={e => setFrom(e.target.value)} placeholder="First word" required maxLength={60}/></label><span className="between">⟷</span><label><span className="sr-only">Destination word</span><input value={to} onChange={e => setTo(e.target.value)} placeholder="Second word" required maxLength={60}/></label></>}
          <button className="primary" disabled={busy}>{busy ? 'Exploring…' : mode === 'dictionary' ? 'Define word' : 'Connect words'} <span>↗</span></button>
        </form>
        <div className="suggestions"><span>TRY</span>{mode === 'dictionary' ? ['serendipity', 'liminal', 'sonder', 'petrichor'].map(w => <button disabled={busy} key={w} onClick={() => void define(w)}>{w} ↗</button>) : [['ocean', 'music'], ['coffee', 'space'], ['memory', 'forest']].map(([a,b]) => <button disabled={busy} key={a} onClick={() => void connect(a,b)}>{a} <span>→</span> {b}</button>)}</div>
      </div>
      {busy && <div className="loading" role="status"><span className="spinner"/><strong>{progress}</strong><p>{mode === 'connections' ? 'Building your graph in saved steps. The first exploration may take a few minutes.' : 'A definition, examples, and a little context.'}</p><button className="text-button" onClick={() => { controller.current?.abort(); setBusy(false); }}>Stop</button></div>}
      {error && <div className="error" role="alert">{error}<span>Completed steps are saved. Submit again to retry.</span></div>}
      {!busy && !error && mode === 'dictionary' && definition && <article className="definition">
        <div className="result-meta"><span>DICTIONARY ENTRY</span><span className="cache-badge">{cached ? '↺ Saved result' : '✧ Newly explored'}</span></div>
        <h2>{definition.word}</h2><p className="pronunciation">{definition.pronunciation}</p>
        <div className="senses">{definition.senses.map((sense, i) => <div className="sense" key={i}><span className="sense-number">{String(i + 1).padStart(2,'0')}</span><div><span className="part-of-speech">{sense.partOfSpeech}</span><p>{sense.definition}</p><blockquote>“{sense.example}”</blockquote></div></div>)}</div>
        <div className="definition-details">{definition.origin && <div><h3>WORD ORIGIN</h3><p>{definition.origin}</p></div>}<div><h3>NEARBY WORDS</h3><div className="synonyms">{definition.synonyms.map(s => <button key={s} onClick={() => void define(s)}>{s} ↗</button>)}</div></div></div>
        {definition.note && <p className="entry-note">{definition.note}</p>}<p className="ai-note">AI-generated interpretation. Meanings and origins may need verification.</p>
      </article>}
      {!busy && !error && mode === 'connections' && graph && <article className="graph-result"><div className="result-meta"><span>CONNECTION MAP</span><span className="cache-badge">{cached ? '↺ Saved result' : '✧ Newly explored'}</span></div><div className="graph-title"><h2>{graph.from} <span>⟷</span> {graph.to}</h2><p>{graph.pathCount} paths · {graph.nodes.length} words · {graph.links.length} connections</p></div><Graph graph={graph} onWord={w => void define(w)}/><details className="paths"><summary>Explore the {graph.pathCount} generated paths</summary><ol>{graph.paths.map((path, i) => <li key={i}>{path.map((w,j) => <span key={j}>{j > 0 && <i> → </i>}<button onClick={() => void define(w)}>{w}</button></span>)}</li>)}</ol></details><p className="ai-note">Solid lines show generated associations. Dotted lines connect each word to its 3 nearest embedding neighbours within this graph. Distances are illustrative; select a node to inspect its connections.</p></article>}
      {!busy && !error && (mode === 'dictionary' ? !definition : !graph) && <div className="empty-result"><span className="empty-symbol">{mode === 'dictionary' ? '“ ”' : '•—•'}</span><h3>{mode === 'dictionary' ? 'Every word has a story.' : 'There’s a connection waiting to be found.'}</h3><p>{mode === 'dictionary' ? 'Enter a word above to discover its meaning, origin, and related words.' : 'Choose two words to explore the associations between them.'}</p></div>}
    </section>
    <footer><span>llm dictionary <i>—</i> a place for curious minds</span><span>Powered by Gemini · Results saved for next time</span></footer>
  </main>;
}
