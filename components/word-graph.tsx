'use client';
import { useEffect, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY, type SimulationNodeDatum } from 'd3-force';
import type { WordGraph } from '../lib/types';
type Node = SimulationNodeDatum & WordGraph['nodes'][number];
type Link = { source: Node | string; target: Node | string; similarity: number; kind: string; count: number };
export default function WordGraphView({ graph, onWord }: { graph: WordGraph; onWord: (word: string) => void }) {
  const [positions, setPositions] = useState<{ nodes: Node[]; links: Link[] }>({ nodes: [], links: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<Node>> | null>(null);
  const dragRef = useRef<Node | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    setSelected(null); setZoom(1);
    const nodes: Node[] = graph.nodes.map(n => ({ ...n, ...(n.id === graph.from ? { fx: 160, fy: 270 } : n.id === graph.to ? { fx: 840, fy: 270 } : {}) }));
    const links: Link[] = graph.links.map(l => ({ ...l }));
    const simulation = forceSimulation(nodes).force('link', forceLink<Node, Link>(links).id(d => d.id).distance(l => l.kind === 'neighbour' ? 90 : 115).strength(l => l.kind === 'neighbour' ? 0.025 : 0.07)).force('charge', forceManyBody().strength(-100)).force('center', forceCenter(500, 270)).force('collision', forceCollide<Node>().radius(n => n.endpoint ? 50 : 24)).force('x', forceX(500).strength(0.03)).force('y', forceY(270).strength(0.07));
    simulationRef.current = simulation;
    simulation.on('tick', () => setPositions({ nodes: [...nodes], links: [...links] }));
    return () => { simulation.stop(); };
  }, [graph]);
  const adjacent = new Set(selected ? graph.links.filter(l => l.source === selected || l.target === selected).flatMap(l => [l.source, l.target]) : []);
  const selectedNode = graph.nodes.find(n => n.id === selected);
  function move(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current) return;
    const point = svgRef.current.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const group = svgRef.current.querySelector('g'); const matrix = group?.getScreenCTM();
    if (matrix) { const position = point.matrixTransform(matrix.inverse()); dragRef.current.fx = position.x; dragRef.current.fy = position.y; simulationRef.current?.alpha(0.15).restart(); }
  }
  return <div className="graph-shell">
    <div className="graph-toolbar"><span><i className="dot green"/> association <i className="dot muted"/> embedding neighbour</span><div><button aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}>−</button><button onClick={() => setZoom(1)}>Reset</button><button aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + 0.2))}>+</button></div></div>
    <svg ref={svgRef} viewBox="0 0 1000 540" role="img" aria-label={`Semantic graph connecting ${graph.from} and ${graph.to}. Select a word to inspect its neighbours.`} onPointerMove={move} onPointerUp={() => { if (dragRef.current && !dragRef.current.endpoint) { dragRef.current.fx = null; dragRef.current.fy = null; } dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
      <g transform={`translate(500 270) scale(${zoom}) translate(-500 -270)`}>
        {positions.links.map((l, i) => { const a = l.source as Node, b = l.target as Node; const active = !selected || a.id === selected || b.id === selected; return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.kind === 'neighbour' ? '#a9b5ab' : '#789780'} strokeWidth={l.kind === 'neighbour' ? 0.7 : Math.min(3, 0.7 + l.count / 10)} strokeDasharray={l.kind === 'neighbour' ? '3 5' : undefined} opacity={active ? l.kind === 'neighbour' ? 0.35 : 0.6 : 0.06}><title>{a.id} ↔ {b.id}: cosine similarity {l.similarity.toFixed(3)}{l.kind === 'association' ? ` · ${l.count} paths` : ' · embedding neighbour'}</title></line>;  })}
        {positions.nodes.map(n => <g key={n.id} transform={`translate(${n.x},${n.y})`} opacity={!selected || adjacent.has(n.id) || selected === n.id ? 1 : 0.22} role="button" tabIndex={0} aria-label={`Inspect ${n.id}`} onClick={() => setSelected(n.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(n.id); } }} onPointerDown={e => { dragRef.current = n; svgRef.current?.setPointerCapture(e.pointerId); }} className="graph-node">
          <circle r={n.endpoint ? 19 : 4 + Math.sqrt(n.count) * 0.65} fill={n.endpoint ? '#244b3b' : selected === n.id ? '#c17745' : '#6f9474'} stroke="#faf9f5" strokeWidth={2}/>
          <text y={n.endpoint ? 38 : -13} textAnchor="middle" fontSize={n.endpoint ? 18 : 11} fontWeight={n.endpoint ? 700 : 500} fill="#2c4537" paintOrder="stroke" stroke="#faf9f5" strokeWidth="3">{n.id}</text>
        </g>)}
      </g>
    </svg>
    <div className="graph-inspector">{selectedNode ? <><div><strong>{selectedNode.id}</strong><span>Appears in {selectedNode.count} paths · {adjacent.size - 1} connected words</span></div><button className="text-button" onClick={() => onWord(selectedNode.id)}>Look up definition ↗</button></> : <span>Select any word to explore its neighbours. Drag nodes to rearrange; use + and − to zoom.</span>}</div>
  </div>;
}
