import { createWriteStream } from 'node:fs'
import { mkdir, open, unlink, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractZip, isZipBuffer } from './zip.js'

export const inject = ['webServer', 'sessions']

const ROUTE = '/agent-hub/file-upload'
const CONFIG_ROUTE = '/agent-hub/file-upload/config'
const DEFAULT_MAX_MB = 25
const MIN_MAX_MB = 1
const MAX_MAX_MB = 2048
const CONFIG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'config.json')

/** Content types we accept as raw binary uploads (parameters are ignored). */
const ACCEPTED_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-rar-compressed',
])

/** Clamp an arbitrary value into the valid max-MB range, or undefined. */
function normalizeMaxMb(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return undefined
  const clamped = Math.round(number)
  if (clamped < MIN_MAX_MB || clamped > MAX_MAX_MB) return undefined
  return clamped
}

async function readConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const maxMb = normalizeMaxMb(parsed?.maxUploadMb)
    if (maxMb !== undefined) return { maxUploadMb: maxMb }
  } catch {
    // missing or unreadable config falls back to defaults
  }
  return { maxUploadMb: DEFAULT_MAX_MB }
}

async function writeConfig(patch) {
  const current = await readConfig()
  const next = { ...current, ...patch }
  await mkdir(dirname(CONFIG_PATH), { recursive: true })
  await writeFile(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}

function answer(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(payload)
}

function safeName(raw) {
  const leaf = basename(raw).normalize('NFC')
  const cleaned = leaf
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 180)
  if (!cleaned || cleaned === '.' || cleaned === '..') return 'uploaded-file'
  return cleaned
}

/**
 * Same-origin guard for the upload endpoint. Accepts the loopback host
 * under its usual spellings (127.0.0.1 / localhost / ::1) on the exact port
 * the web server listens on; requests without an Origin header are rejected
 * (cross-site pages cannot forge a loopback Origin).
 */
function sameOrigin(req, ctx) {
  const origin = req.headers.origin
  if (typeof origin !== 'string') return false
  try {
    const parsed = new URL(origin)
    const host = parsed.hostname.toLowerCase()
    const loopback = host === '127.0.0.1' || host === 'localhost' || host === '::1'
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && loopback
      && Number(parsed.port) === ctx.webServer.port
  } catch {
    return false
  }
}

async function uniqueTarget(directory, requestedName) {
  const extension = extname(requestedName)
  const stem = requestedName.slice(0, requestedName.length - extension.length) || 'uploaded-file'
  // Prefer the original name; on collision grow a predictable sequence
  // (report.zip, report-1.zip, report-2.zip) instead of random suffixes.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidateName = attempt === 0 ? `${stem}${extension}` : `${stem}-${attempt}${extension}`
    const candidate = join(directory, candidateName)
    try {
      const handle = await open(candidate, 'wx')
      await handle.close()
      return candidate
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  throw new Error('Unable to allocate a unique upload name.')
}

async function receive(req, target, expectedLength, maxBytes) {
  let received = 0
  const output = createWriteStream(target, { flags: 'w' })
  try {
    for await (const chunk of req) {
      received += chunk.length
      if (received > maxBytes) throw new Error('FILE_TOO_LARGE')
      if (!output.write(chunk)) await new Promise(resolveDrain => output.once('drain', resolveDrain))
    }
    await new Promise((resolveDone, rejectDone) => {
      output.once('error', rejectDone)
      output.end(resolveDone)
    })
    if (expectedLength !== undefined && received !== expectedLength) throw new Error('INCOMPLETE_UPLOAD')
    return received
  } catch (error) {
    output.destroy()
    await unlink(target).catch(() => {})
    throw error
  }
}

/**
 * Inspect a saved upload; if it is a ZIP archive (by magic bytes), extract it
 * next to itself and describe the result. Returns null for non-ZIP uploads.
 */
async function tryExtractZip(filePath, uploadDirectory, workspaceRoot) {
  let isZip = false
  try {
    const handle = await open(filePath, 'r')
    try {
      const head = Buffer.alloc(4)
      const { bytesRead } = await handle.read(head, 0, 4, 0)
      isZip = bytesRead === 4 && isZipBuffer(head)
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
  if (!isZip) return null

  let buffer
  try {
    buffer = await readFile(filePath)
  } catch {
    return null
  }
  const stem = basename(filePath, extname(filePath)) || 'archive'
  const destination = join(uploadDirectory, stem)
  try {
    const { files, skipped, bytes } = await extractZip(buffer, destination)
    return {
      kind: 'zip',
      extracted: relative(workspaceRoot, destination).split(sep).join('/'),
      files,
      skipped,
      extractedBytes: bytes,
    }
  } catch (error) {
    // Do not leave a half-extracted directory behind (zip bomb, corrupt
    // archive, entry cap…). The uploaded .zip itself stays.
    await rm(destination, { recursive: true, force: true }).catch(() => {})
    return {
      kind: 'zip',
      extractError: error instanceof Error ? error.message : String(error),
    }
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: CONFIG_ROUTE,
    async handler(req, res) {
      // GET is a read-only public config lookup: browsers send same-origin
      // GETs WITHOUT an Origin header, so requiring one would 403 the very
      // request that loads the saved limit after a page refresh. Only the
      // write path (POST) needs the strict same-origin check.
      if (req.method === 'GET') {
        const config = await readConfig()
        answer(res, 200, { ok: true, ...config, minMb: MIN_MAX_MB, maxMb: MAX_MAX_MB, defaultMb: DEFAULT_MAX_MB })
        return
      }
      if (!sameOrigin(req, ctx)) {
        answer(res, 403, { ok: false, error: 'Upload origin was rejected.' })
        return
      }
      if (req.method !== 'POST') {
        answer(res, 405, { ok: false, error: 'Only GET and POST are supported.' })
        return
      }
      let body = ''
      for await (const chunk of req) body += chunk
      let parsed
      try {
        parsed = JSON.parse(body || '{}')
      } catch {
        answer(res, 400, { ok: false, error: 'Invalid JSON body.' })
        return
      }
      const maxUploadMb = normalizeMaxMb(parsed?.maxUploadMb)
      if (maxUploadMb === undefined) {
        answer(res, 400, {
          ok: false,
          error: `maxUploadMb must be an integer between ${MIN_MAX_MB} and ${MAX_MAX_MB}.`,
        })
        return
      }
      const config = await writeConfig({ maxUploadMb })
      ctx.logger.info(`workspace-file-upload: max upload size set to ${maxUploadMb} MB`)
      answer(res, 200, { ok: true, ...config })
    },
  }), 'agent-hub: workspace file upload config route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    async handler(req, res) {
      if (req.method !== 'POST') {
        answer(res, 405, { ok: false, error: 'Only POST is supported.' })
        return
      }
      if (!sameOrigin(req, ctx)) {
        answer(res, 403, { ok: false, error: 'Upload origin was rejected.' })
        return
      }
      const contentType = String(req.headers['content-type'] ?? '')
        .split(';')[0].trim().toLowerCase()
      if (contentType && !ACCEPTED_CONTENT_TYPES.has(contentType)) {
        answer(res, 415, {
          ok: false,
          error: `Unsupported upload content type "${contentType}".`,
        })
        return
      }
      const { maxUploadMb } = await readConfig()
      const maxBytes = maxUploadMb * 1024 * 1024
      const lengthHeader = req.headers['content-length']
      const length = lengthHeader === undefined ? undefined : Number(lengthHeader)
      if (length !== undefined && (!Number.isSafeInteger(length) || length < 0 || length > maxBytes)) {
        answer(res, 413, { ok: false, error: `File exceeds the ${maxUploadMb} MB limit.` })
        return
      }

      const url = new URL(req.url ?? ROUTE, 'http://127.0.0.1')
      const sessionId = url.searchParams.get('sessionId') ?? ''
      const requestedName = url.searchParams.get('name') ?? ''
      const session = ctx.sessions.get(sessionId)
      const workspace = session?.header.cwd
      if (!workspace) {
        answer(res, 404, { ok: false, error: 'The active session workspace was not found.' })
        return
      }

      const workspaceRoot = resolve(workspace)
      const uploadDirectory = resolve(workspaceRoot, '.agent-hub', 'uploads')
      const boundary = `${workspaceRoot}${sep}`
      if (uploadDirectory !== workspaceRoot && !uploadDirectory.startsWith(boundary)) {
        answer(res, 400, { ok: false, error: 'The upload target is outside the workspace.' })
        return
      }

      let target
      try {
        await mkdir(uploadDirectory, { recursive: true })
        target = await uniqueTarget(uploadDirectory, safeName(requestedName))
        const bytes = await receive(req, target, length, maxBytes)
        const relativePath = relative(workspaceRoot, target).split(sep).join('/')
        const zipInfo = await tryExtractZip(target, uploadDirectory, workspaceRoot)
        ctx.logger.info(
          `workspace-file-upload: saved ${bytes} bytes as ${relativePath}`
          + (zipInfo?.kind === 'zip' ? `, extracted to ${zipInfo.extracted ?? '(failed)'}` : ''),
        )
        answer(res, 201, {
          ok: true,
          path: relativePath,
          bytes,
          ...(zipInfo ?? { kind: 'file' }),
        })
      } catch (error) {
        if (target) await unlink(target).catch(() => {})
        const tooLarge = error instanceof Error && error.message === 'FILE_TOO_LARGE'
        ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
        answer(res, tooLarge ? 413 : 400, {
          ok: false,
          error: tooLarge ? `File exceeds the ${maxUploadMb} MB limit.` : 'The file could not be saved.',
        })
      }
    },
  }), 'agent-hub: workspace file upload route')
}
