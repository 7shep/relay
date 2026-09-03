import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHandoff, createRun, createSignal, getProviderHealth, readAgentWorkspace, writeAgentWorkspace } from './academicRuntime.js'
import { createLunaProvider } from './lunaProvider.js'

describe('academic runtime records', () => {
  beforeEach(() => {
    const values = new Map()
    globalThis.localStorage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }
  })

  it('seeds and persists a durable workspace', () => {
    const workspace = readAgentWorkspace()
    expect(workspace.courses).toHaveLength(2)
    expect(workspace.assignments[0].rubric).toHaveLength(4)

    workspace.learnerProfile.patterns = ['corrected locally']
    writeAgentWorkspace(workspace)
    expect(readAgentWorkspace().learnerProfile.patterns).toEqual(['corrected locally'])
  })

  it('creates traceable runs, handoffs, and learner signals', () => {
    const run = createRun({ agent: 'assignment', label: 'draft review', inputs: ['draft-1'], reason: 'criterion evidence is missing' })
    const handoff = createHandoff({ source: 'assignment', target: 'tutor', reason: 'repair the missing concept', inputArtifacts: ['review-1'] })
    const signal = createSignal({ type: 'successful repair', concept: 'evaluation design', courseId: 'course-cs441', evidence: 'baseline explained', confidence: 0.84, sourceArtifactId: 'session-1' })

    expect(run).toMatchObject({ agent: 'assignment', status: 'completed', inputs: ['draft-1'] })
    expect(handoff).toMatchObject({ source: 'assignment', target: 'tutor', status: 'completed', requiresApproval: false })
    expect(signal).toMatchObject({ type: 'successful repair', concept: 'evaluation design', confidence: 0.84 })
  })

  it('reports an unconfigured provider instead of pretending a run succeeded', () => {
    expect(getProviderHealth()).toMatchObject({ provider: 'Luna 5.6', status: 'not configured', endpointConfigured: false })
  })

  it('fails clearly when an unconfigured provider is asked to run', async () => {
    await expect(createLunaProvider().run({ agent: 'assignment', context: {}, signal: new AbortController().signal })).rejects.toThrow('Luna bridge is not configured')
  })

  it('sends structured context through a configured bridge', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, body: null, json: async () => ({ summary: 'bridge review complete' }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await createLunaProvider({ endpoint: 'http://localhost:4111' }).run({ agent: 'assignment', context: { artifactIds: ['draft-1'] }, signal: new AbortController().signal })
    expect(result.summary).toBe('bridge review complete')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4111/runs', expect.objectContaining({ method: 'POST' }))
    vi.unstubAllGlobals()
  })
})
