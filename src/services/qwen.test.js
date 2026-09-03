import { describe, expect, it } from 'vitest'
import { normalizeSyllabusResponse } from './qwen.js'

describe('syllabus routing contract', () => {
  const sources = [{ name: 'clear.txt', text: 'CISC301 syllabus' }, { name: 'unclear.pdf', text: 'Weekly assignments' }]

  it('normalizes one independent route per source and preserves assignment compatibility', () => {
    const result = normalizeSyllabusResponse({ sources: [
      { sourceFilename: 'clear.txt', courseId: 'cisc301', courseLabel: 'CISC301', confidence: 0.98, evidence: 'header: CISC301', needsClassName: false, assignments: [{ title: 'Lab 1', dueAt: '2026-09-10', kind: 'lab', weight: '10%' }] },
      { sourceFilename: 'unclear.pdf', courseId: '', courseLabel: '', confidence: 0.2, evidence: 'no class header', needsClassName: true, assignments: [{ title: 'Essay', dueAt: '', kind: 'paper' }] },
    ] }, new Date('2026-09-02T12:00:00Z'), sources)
    expect(result.routes).toHaveLength(2)
    expect(result.routes[0]).toMatchObject({ courseId: 'cisc301', needsClassName: false, evidence: 'header: CISC301' })
    expect(result.routes[1].needsClassName).toBe(true)
    expect(result.assignments).toMatchObject([{ title: 'Lab 1', course: 'CISC301', courseId: 'cisc301', sourceFilename: 'clear.txt' }, { title: 'Essay', courseId: '', sourceFilename: 'unclear.pdf' }])
  })
})
