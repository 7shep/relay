import { createHash, randomBytes } from 'node:crypto'
import { appendFile, link, mkdir, readFile, readdir, stat, lstat, writeFile, unlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'

const port = Number(process.env.RELAY_BRIDGE_PORT || 4112)
const root = resolve(process.env.RELAY_STUDY_ROOT || 'study-context')
const secret = process.env.RELAY_BRIDGE_SECRET || ''
const configuredUploadMb = Number(process.env.RELAY_BRIDGE_MAX_UPLOAD_MB || 25)
const configuredBodyMb = Number(process.env.RELAY_BRIDGE_MAX_BODY_MB || 36)
const maxUploadBytes = (Number.isFinite(configuredUploadMb) ? Math.max(1, configuredUploadMb) : 25) * 1024 * 1024
const maxBodyBytes = Math.max(maxUploadBytes * 1.4, (Number.isFinite(configuredBodyMb) ? Math.max(1, configuredBodyMb) : 36) * 1024 * 1024)
const proposals = new Map()
const courseLocks = new Map()

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
    if (size > maxBodyBytes) throw new Error(`request exceeds configured ${Math.round(maxBodyBytes / 1024 / 1024)} MB request limit; PDF uploads are limited to ${Math.round(maxUploadBytes / 1024 / 1024)} MB`)
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

function safeFilename(value) {
  const original = String(value || '').normalize('NFKC').split(/[\\/]/).pop().trim()
  const cleaned = original.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/\s+/g, ' ').replace(/^\.+$/, '').slice(0, 180).trim()
  if (!cleaned) throw new Error('original filename is required')
  return cleaned
}

function decodeMaterial(material) {
  const source = material?.originalContent
  if (!source || !['base64', 'utf8'].includes(source.encoding)) throw new Error('material originalContent must use base64 or utf8 encoding')
  if (source.encoding === 'base64' && (!/^[A-Za-z0-9+/]*={0,2}$/.test(String(source.data || '')) || String(source.data || '').length % 4 === 1)) throw new Error('material base64 payload is malformed')
  const bytes = source.encoding === 'base64' ? Buffer.from(String(source.data || ''), 'base64') : Buffer.from(String(source.data || ''), 'utf8')
  if (!bytes.length) throw new Error('material original content is empty')
  if (bytes.length > maxUploadBytes) throw new Error(`material exceeds configured ${Math.round(maxUploadBytes / 1024 / 1024)} MB upload limit; original bytes were not stored`)
  return bytes
}

async function readManifest(courseId) {
  const path = await assertSafePath(courseId, 'materials/manifest.json')
  try {
    const value = JSON.parse(await readFile(path, 'utf8'))
    return Array.isArray(value) ? value : []
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
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

function relativePath(path) {
  return relative(root, path).split(sep).join('/')
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
    try {
      const signalPath = await assertSafePath(courseId, `learner/signals/${name}`)
      claims.push(JSON.parse(await readFile(signalPath, 'utf8')))
    } catch { /* malformed or escaped evidence remains on disk but is not trusted */ }
  }
  const normalizedClaims = claims.map((item) => ({ ...(item.claim && typeof item.claim === 'object' ? item.claim : item), sessionId: item.sessionId, sourceRef: item.sourceRef, evidenceRefs: item.evidenceRefs || (item.sourceRef ? [item.sourceRef] : []) }))
  return { courseId, strengths: normalizedClaims.filter((item) => item.type === 'strength' && item.status !== 'superseded'), activeStruggles: normalizedClaims.filter((item) => item.type === 'struggle' && item.status !== 'superseded'), recentRepairs: normalizedClaims.filter((item) => item.type === 'repair' && item.status !== 'superseded'), suggestedPractice: [], sourceSessionIds: [...new Set(normalizedClaims.map((item) => item.sessionId).filter(Boolean))] }
}

async function commitMaterial(operation, token) {
  if (!tokenMatches(operation, token)) throw new Error('approval token is missing, expired, reused, or does not match the proposal')
  operation.status = 'writing'; operation.approvalToken.used = true
  const material = operation.material
  let rawPath
  try {
    const bytes = decodeMaterial(material)
    const byteHash = hash(bytes)
    if (byteHash !== operation.contentHash) throw new Error('material content hash changed before commit')
    const filename = safeFilename(material.originalName || material.filename)
    rawPath = await assertSafePath(operation.courseId, `materials/file-uploaded/${filename}`)
    const extractedPath = await assertSafePath(operation.courseId, `materials/extracted/${material.artifactId}.txt`)
    const assignmentPath = await assertSafePath(operation.courseId, `assignments/derived/${material.artifactId}.json`)
    const manifestPath = await assertSafePath(operation.courseId, 'materials/manifest.json')
    const existingManifest = await readManifest(operation.courseId)
    const duplicate = existingManifest.find((item) => item.byteHash === byteHash)
    if (duplicate) {
      operation.status = 'failed'; operation.reason = 'duplicate artifact retained; no files were overwritten'; operation.duplicateOf = duplicate.artifactId; operation.completedAt = new Date().toISOString(); return operation
    }
    try { await stat(rawPath); operation.status = 'failed'; operation.reason = 'destination already exists; no files were overwritten'; operation.completedAt = new Date().toISOString(); return operation } catch (error) { if (error.code !== 'ENOENT') throw error }
    await mkdir(dirname(rawPath), { recursive: true }); await mkdir(dirname(extractedPath), { recursive: true }); await mkdir(dirname(assignmentPath), { recursive: true }); await mkdir(dirname(manifestPath), { recursive: true })
    const tempPath = `${rawPath}.partial-${randomBytes(6).toString('hex')}`
    try {
      await writeFile(tempPath, bytes, { flag: 'wx' })
      await link(tempPath, rawPath)
      await unlink(tempPath)
      await writeFile(extractedPath, String(material.extractedText || ''), { flag: 'wx', encoding: 'utf8' })
      await writeFile(assignmentPath, JSON.stringify({ schemaVersion: 1, artifactId: material.artifactId, sourceArtifactId: material.artifactId, assignments: material.derivedAssignments || [], assignmentId: material.assignmentId || null }, null, 2), { flag: 'wx', encoding: 'utf8' })
      const manifest = [...existingManifest, { artifactId: material.artifactId, courseId: operation.courseId, sourceType: material.sourceType || 'course material', originalFilename: String(material.originalName || material.filename), relativePath: relativePath(rawPath), byteHash, importTime: new Date().toISOString(), parseStatus: material.parseStatus || 'parsed', derivedExtractedText: relativePath(extractedPath), derivedAssignmentMetadata: relativePath(assignmentPath), assignmentId: material.assignmentId || null }]
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'w', encoding: 'utf8' })
    } catch (error) {
      try { await unlink(tempPath) } catch { /* no temporary file remains */ }
      operation.status = 'failed'; operation.reason = `material write failed: ${error.message}`; operation.completedAt = new Date().toISOString(); return operation
    }
    operation.status = 'committed'; operation.completedAt = new Date().toISOString(); operation.result = { artifactId: material.artifactId, rawPath: relativePath(rawPath), manifestPath: relativePath(manifestPath) }
    await journal(operation.courseId, { operationId: operation.id, type: operation.type, status: operation.status, contentHash: operation.contentHash })
    return operation
  } catch (error) {
    operation.status = 'failed'; operation.reason = error.message; operation.completedAt = new Date().toISOString(); return operation
  }
}

async function commit(operation, token) {
  return withCourseLock(operation.courseId, async () => {
    if (operation.type === 'ingest_course_material') return commitMaterial(operation, token)
    if (!tokenMatches(operation, token)) throw new Error('approval token is missing, expired, reused, or does not match the proposal')
    operation.status = 'writing'; operation.approvalToken.used = true
    if (operation.type !== 'save_session') throw new Error('Unsupported operation type')
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
  })
}

async function withCourseLock(courseId, action) {
  const previous = courseLocks.get(courseId) || Promise.resolve()
  let release
  const current = new Promise((resolve) => { release = resolve })
  courseLocks.set(courseId, current)
  await previous
  try { return await action() } finally {
    release()
    if (courseLocks.get(courseId) === current) courseLocks.delete(courseId)
  }
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
    if (url.pathname === '/propose_ingest_material' && request.method === 'POST') {
      const payload = await body(request); const material = payload.material
      assertCourse(payload.courseId)
      const bytes = decodeMaterial(material)
      const filename = safeFilename(material.originalName || material.filename)
      const byteHash = hash(bytes)
      const artifactId = `artifact-${Date.now()}-${randomBytes(4).toString('hex')}`
      const rootPath = `courses/${payload.courseId.toUpperCase()}`
      const operation = { id: `operation-${Date.now()}-${randomBytes(4).toString('hex')}`, type: 'ingest_course_material', status: 'proposed', courseId: payload.courseId, contentHash: byteHash, idempotencyKey: request.headers['idempotency-key'] || `${payload.courseId}:${byteHash}`, createdAt: new Date().toISOString(), destinationPaths: [`${rootPath}/materials/file-uploaded/${filename}`, `${rootPath}/materials/extracted/${artifactId}.txt`, `${rootPath}/assignments/derived/${artifactId}.json`, `${rootPath}/materials/manifest.json`, `${rootPath}/operations/journal.jsonl`], diff: payload.diff || { rawArtifact: filename, learnerClaims: [], warnings: [] }, material: { ...material, artifactId, originalName: String(material.originalName || material.filename), filename, originalContent: material.originalContent } }
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
  } catch (error) { return json(response, /exceeds configured .* limit|exceeds .* upload limit/.test(error.message) ? 413 : 400, { error: error.message }) }
}

createServer((request, response) => { handle(request, response).catch((error) => json(response, 500, { error: error.message })) }).listen(port, '127.0.0.1', () => {
  console.log(`Relay study bridge listening on http://127.0.0.1:${port}`)
  console.log(`Study root: ${root}`)
  if (!secret) console.warn('RELAY_BRIDGE_SECRET is not set; write endpoints are disabled.')
})
