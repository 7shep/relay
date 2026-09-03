import { describe, expect, it } from 'vitest'
import { buildVaultGraph, parseMarkdownFrontmatter, parseWikilinks } from './vaultGraph.js'

const notes = [
  { path: 'courses/CS-441/index.md', content: '---\ntype: course\ncourse: CS-441\n---\n# CS-441\n\n[[concepts/recursion]]' },
  { path: 'courses/CS-441/concepts/recursion.md', content: '---\ntype: concept\ncourse: CS-441\ntopic: recursion\nconfidence: 0.84\n---\n# recursion\n\n[[../sessions/session-001]]' },
  { path: 'courses/CS-441/sessions/session-001.md', content: '---\ntype: study-session\ncourse: CS-441\ntopic: recursion\nsession_id: session-001\n---\n# recursion · 2026-09-03\n\n[[../concepts/recursion]]\n[[../assignments/lab-1]]\n[[../../../learner/profile]]' },
  { path: 'courses/CS-441/assignments/lab-1.md', content: '---\ntype: assignment\ncourse: CS-441\nassignment: Lab 1\n---\n# Lab 1\n\n[[../sessions/session-001]]' },
  { path: 'courses/CS-441/learner/signals/session-001-1.md', content: '---\ntype: learner-signal\ncourse: CS-441\ntopic: recursion\nclaim_type: recurring_mistake\nconfidence: 0.62\n---\n# Forgets the base case\n\n[[../sessions/session-001]]' },
  { path: 'learner/profile.md', content: '---\ntype: learner-profile\nstatus: hypotheses\n---\n# Learner profile' },
]

describe('vault graph normalizer', () => {
  it('parses scalar and array frontmatter plus wikilinks', () => {
    expect(parseMarkdownFrontmatter('---\ncourse: CS-441\nconcepts: [recursion, "base cases"]\nconfidence: 0.8\n---\n')).toMatchObject({ course: 'CS-441', concepts: ['recursion', 'base cases'], confidence: 0.8 })
    expect(parseWikilinks('[[../concepts/recursion|recursion]] and ![[assets/diagram.png]]')).toEqual([{ target: '../concepts/recursion', label: 'recursion' }, { target: 'assets/diagram.png', label: '' }])
  })

  it('turns course Markdown into note nodes and resolved wikilink edges', () => {
    const graph = buildVaultGraph(notes, { courseId: 'cs-441' })
    expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(['index', 'concepts/recursion', 'sessions/session-001', 'assignments/lab-1', 'learner/signals/session-001-1', 'learner/profile']))
    expect(graph.edges).toEqual(expect.arrayContaining([
      { source: 'sessions/session-001', target: 'concepts/recursion' },
      { source: 'sessions/session-001', target: 'assignments/lab-1' },
      { source: 'sessions/session-001', target: 'learner/profile' },
    ]))
    expect(graph.nodes.find((node) => node.id === 'concepts/recursion')).toMatchObject({ label: 'recursion', type: 'concept', metadata: { confidence: 0.84, evidenceType: 'concept' } })
  })

  it('keeps a bounded two-hop topic neighborhood', () => {
    const graph = buildVaultGraph(notes, { courseId: 'cs-441', topic: 'recursion' })
    expect(graph.scope).toBe('course')
    expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(['concepts/recursion', 'sessions/session-001', 'assignments/lab-1', 'learner/profile']))
    expect(graph.nodes).not.toHaveLength(0)
    expect(buildVaultGraph(notes, { courseId: 'cs-441', topic: 'linear algebra' }).nodes).toHaveLength(0)
  })
})
