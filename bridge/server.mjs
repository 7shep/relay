import { createHash, randomBytes } from 'node:crypto'
import { appendFile, mkdir, readFile, readdir, stat, lstat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

const port = Number(process.env.RELAY_BRIDGE_PORT || 4112)
const root = resolve(process.env.RELAY_STUDY_ROOT || 'study-context')
const secret = process.env.RELAY_BRIDGE_SECRET || ''
const maxBodyBytes = 2 * 1024 * 1024
const proposals = new Map()

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' })
  response.end(JSON.stringify(body))
}

function authorized(request, write = false) {
  if (!write && request.method === 'GET') return true
  return Boolean(secret && request.headers.authorization === `Bearer ${secret}`)
}

async function body(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) throw new Error('request exceeds 2 MB limit')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function slug(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function assertCourse(courseId) {
  if (!courseId || slug(courseId) !== courseId) throw new Error('courseId must be a lowercase slug such as cs-441')
}

async function assertSafePath(courseId, relativePath) {
  assertCourse(courseId)
  if (!relativePath || relativePath.includes('\0')) throw new Error('destination path is outside the course allowlist')
  if (relativePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(relativePath) || relativePath.split(/[\\/]/).includes('..')) throw new Error('destination path is outside the course allowlist')
  const courseRoot = resolve(root, 'courses', courseId.toUpperCase())
  const target = resolve(courseRoot, relativePath)
  const rel = relative(courseRoot, target)
  if (rel.startsWith(`..${sep}`) || rel === '..' || rel.includes(`..${sep}`)) throw new Error('destination path is outside the course allowlist')
  let current = courseRoot
  const pieces = rel.split(/[\\/]/).filter(Boolean)
  for (const piece of pieces) {
    current = join(current, piece)
    try {
      const info = await lstat(current)
      if (info.isSymbolicLink()) throw new Error('symlinks/reparse points are not allowed in course paths')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      break
    }
  }
  return target
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function tokenFor(operation) {
  return { value: randomBytes(24).toString('hex'), operationId: operation.id, operationType: operation.type, courseId: operation.courseId, contentHash: operation.contentHash, destinationPaths: operation.destinationPaths, diff: operation.diff, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), used: false }
}

function tokenMatches(operation, token) {
  return token?.value && !token.used && new Date(token.expiresAt).getTime() > Date.now() && JSON.stringify(token) === JSON.stringify(operation.approvalToken)
}

async function journal(courseId, entry) {
  const path = await assertSafePath(courseId, 'operations/journal.jsonl')
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, 'utf8')
}

async function courseContext(courseId) {
  const signalsPath = await assertSafePath(courseId, 'learner/signals')
  let names = []
  try { names = await readdir(signalsPath) } catch (error) { if (error.code !== 'ENOENT') throw error }
  const claims = []
  for (const name of names.slice(-50)) {
    if (extname(name) !== '.json') continue
    try { claims.push(JSON.parse(await readFile(join(signalsPath, name), 'utf8'))) } catch { /* malformed evidence remains on disk but is not trusted */ }
  }
  const normalizedClaims = claims.map((item) => ({ ...(item.claim && typeof item.claim === 'object' ? item.claim : item), sessionId: item.sessionId, sourceRef: item.sourceRef, evidenceRefs: item.evidenceRefs || (item.sourceRef ? [item.sourceRef] : []) }))
  return { courseId, strengths: normalizedClaims.filter((item) => item.type === 'strength' && item.status !== 'superseded'), activeStruggles: normalizedClaims.filter((item) => item.type === 'struggle' && item.status !== 'superseded'), recentRepairs: normalizedClaims.filter((item) => item.type === 'repair' && item.status !== 'superseded'), suggestedPractice: [], sourceSessionIds: [...new Set(normalizedClaims.map((item) => item.sessionId).filter(Boolean))] }
}

async function commit(operation, token) {
  if (!tokenMatches(operation, token)) throw new Error('approval token is missing, expired, reused, or does not match the proposal')
  operation.status = 'writing'; operation.approvalToken.used = true
  if (operation.type !== 'save_session') throw new Error('This companion currently commits save_session proposals only')
  const bundle = operation.bundle
  const rawPath = await assertSafePath(operation.courseId, `sessions/raw/${bundle.sessionId}.json`)
  const summaryPath = await assertSafePath(operation.courseId, `sessions/summaries/${bundle.sessionId}.json`)
  try { await stat(rawPath); operation.status = 'failed'; operation.reason = 'duplicate artifact retained; no files were overwritten'; return operation } catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(dirname(rawPath), { recursive: true }); await mkdir(dirname(summaryPath), { recursive: true })
  await writeFile(rawPath, bundle.rawSession.content, 'utf8')
  await writeFile(summaryPath, JSON.stringify(bundle, null, 2), 'utf8')
  const claims = [...(bundle.strengthsObserved || []), ...(bundle.strugglesObserved || []), ...(bundle.successfulRepairs || [])]
  for (let index = 0; index < claims.length; index += 1) {
    const signalPath = await assertSafePath(operation.courseId, `learner/signals/${bundle.sessionId}-${index + 1}.json`)
    await mkdir(dirname(signalPath), { recursive: true })
    await writeFile(signalPath, JSON.stringify({ schemaVersion: 1, sessionId: bundle.sessionId, courseId: operation.courseId, claim: claims[index], provenance: bundle.provenance, sourceRef: bundle.evidenceRefs?.[0] || null }, null, 2), 'utf8')
  }
  operation.status = 'committed'; operation.completedAt = new Date().toISOString(); operation.result = { rawPath: relative(root, rawPath), graphRefresh: 'pending' }
  await journal(operation.courseId, { operationId: operation.id, type: operation.type, status: operation.status, contentHash: operation.contentHash, graphRefresh: 'pending' })
  return operation
}

async function handle(request, response) {
  if (request.method === 'OPTIONS') return json(response, 204, {})
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  try {
    if (url.pathname === '/ping' && request.method === 'GET') return json(response, 200, { service: 'relay-study-bridge', protocolVersion: 1, status: 'ready', root: root, writesRequireApproval: true })
    if (url.pathname === '/course_context' && request.method === 'GET') {
      if (!authorized(request)) return json(response, 401, { error: 'authentication required' })
      return json(response, 200, await courseContext(url.searchParams.get('courseId')))
    }
    if (!authorized(request, true)) return json(response, 401, { error: 'authenticated bridge request required' })
    if (url.pathname === '/propose_save_session' && request.method === 'POST') {
      const payload = await body(request); const bundle = payload.bundle
      const requiredArrays = ['conceptsCovered', 'strengthsObserved', 'strugglesObserved', 'successfulRepairs', 'questionTypes', 'testSignals', 'openQuestions', 'evidenceRefs', 'confidence']
      if (bundle?.schemaVersion !== 1 || !bundle.sessionId || !bundle.courseId || !bundle.rawSession?.content || requiredArrays.some((key) => !Array.isArray(bundle[key]))) throw new Error('invalid schema-versioned session bundle')
      assertCourse(bundle.courseId)
      const rawHash = hash(bundle.rawSession.content)
      const operation = { id: `operation-${Date.now()}-${randomBytes(4).toString('hex')}`, type: 'save_session', status: 'proposed', courseId: bundle.courseId, sessionId: bundle.sessionId, contentHash: rawHash, destinationPaths: [`courses/${bundle.courseId.toUpperCase()}/sessions/raw/${bundle.sessionId}.json`, `courses/${bundle.courseId.toUpperCase()}/sessions/summaries/${bundle.sessionId}.json`], diff: payload.diff || { learnerClaims: [], warnings: [] }, bundle, idempotencyKey: request.headers['idempotency-key'] || `${bundle.courseId}:${rawHash}`, createdAt: new Date().toISOString() }
      proposals.set(operation.id, operation); return json(response, 200, operation)
    }
    if (url.pathname === '/approve_operation' && request.method === 'POST') {
      const payload = await body(request); const operation = proposals.get(payload.operationId)
      if (!operation || operation.status !== 'proposed') throw new Error('only a proposed operation can be approved')
      operation.status = 'approved'; operation.approvedAt = new Date().toISOString(); operation.approvalToken = tokenFor(operation); return json(response, 200, operation)
    }
    if (url.pathname === '/commit_operation' && request.method === 'POST') {
      const payload = await body(request); const operation = proposals.get(payload.operationId)
      if (!operation || operation.status !== 'approved') throw new Error('operation must be approved before commit')
      const result = await commit(operation, payload.approvalToken); return json(response, result.status === 'failed' ? 409 : 200, result)
    }
    return json(response, 404, { error: 'not found' })
  } catch (error) { return json(response, error.message === 'request exceeds 2 MB limit' ? 413 : 400, { error: error.message }) }
}

createServer((request, response) => { handle(request, response).catch((error) => json(response, 500, { error: error.message })) }).listen(port, '127.0.0.1', () => {
  console.log(`Relay study bridge listening on http://127.0.0.1:${port}`)
  console.log(`Study root: ${root}`)
  if (!secret) console.warn('RELAY_BRIDGE_SECRET is not set; write endpoints are disabled.')
})
