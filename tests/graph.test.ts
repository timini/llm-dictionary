import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph, cosine, normalizeWord } from '../lib/graph';
test('normalizes cache inputs consistently, preserving Unicode', () => {
  assert.equal(normalizeWord('  CAFÉ  '), 'café');
  assert.equal(normalizeWord('Ice   Cream'), 'ice cream');
});
test('cosine measures angle and rejects mismatched dimensions', () => {
  assert.equal(cosine([1,0], [4,0]), 1);
  assert.equal(cosine([1,0], [0,1]), 0);
  assert.equal(cosine([1,0], [-1,0]), -1);
  assert.throws(() => cosine([1], [1,0]));
});
test('graph retains path edges and connects three nearest semantic neighbours', () => {
  const paths = [['a','b','c'],['a','d','c'],['a','b','c'],['a','e','c']];
  const vectors = new Map([['a',[1,0]],['b',[1,0.1]],['c',[0,1]],['d',[0.1,1]],['e',[-1,0]]]);
  const graph = buildGraph('a','c',paths,vectors,{generation:'test',embedding:'test'});
  assert.equal(graph.pathCount,4);
  assert.equal(graph.nodes.find(n=>n.id==='b')?.count,2);
  assert.equal(graph.nodes.filter(n=>n.endpoint).length,2);
  assert.equal(graph.links.find(l=>l.source==='a' && l.target==='b')?.count,2);
  assert(graph.links.some(l=>l.kind==='neighbour'));
  assert(graph.links.every(l=>l.source!==l.target && Number.isFinite(l.similarity)));
  assert.equal(new Set(graph.links.map(l=>[l.source,l.target].sort().join('|'))).size,graph.links.length);
});
