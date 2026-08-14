/**
 * Minimal, dependency-free ZIP reader for the workspace file-upload plugin.
 *
 * Supports the two standard compression methods that dominate real archives:
 *  - method 0 (STORE): raw copy
 *  - method 8 (DEFLATE): inflateRawSync from node:zlib
 *
 * Safety properties (defense against malicious archives):
 *  - every entry name is normalized and must stay inside the extraction root
 *    (zip-slip / absolute-path / drive-letter / `..` traversal rejected)
 *  - total uncompressed bytes and entry count are capped (zip-bomb guard)
 *  - encrypted entries (general-purpose bit 0) and unknown compression
 *    methods are skipped with a reason instead of failing the whole archive
 *  - symlink entries (unix mode S_IFLNK) are skipped, never materialized
 *
 * The reader is deliberately simple: it uses the central directory as the
 * source of truth for sizes (handles data-descriptor archives correctly),
 * and computes each entry's data offset from its local header.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { inflateRawSync } from 'node:zlib'

/**
 * Structured extraction error. `code` lets the client surface a friendly,
 * localized message instead of the raw English string.
 *   - 'ENTRY_LIMIT'    - entry count exceeded the configured cap
 *   - 'SIZE_LIMIT'     - total uncompressed size exceeded the configured cap
 *   - 'CORRUPT'        - archive structure is invalid
 */
export class ZipExtractError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ZipExtractError'
    this.code = code
  }
}

/**
 * Caps so a hostile or broken archive cannot exhaust disk/memory, while
 * still accepting real-world archives: Windows offline installers routinely
 * pack tens of thousands of entries and extract to hundreds of MB / GB.
 */
export const MAX_EXTRACT_BYTES = 4 * 1024 * 1024 * 1024
export const MAX_EXTRACT_ENTRIES = 100000

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const SIG_EOCD64 = 0x06064b50
const SIG_EOCD64_LOC = 0x07064b50

/** Cheap sniff: PK\x03\x04 (local), PK\x05\x06 (empty), PK\x06\x06 / PK\x06\x07 (zip64). */
export function isZipBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false
  const magic = buffer.readUInt32LE(0)
  return magic === SIG_LOCAL || magic === SIG_EOCD || magic === SIG_EOCD64 || magic === SIG_EOCD64_LOC
}

/** Scan backwards for the End-of-Central-Directory record (last 64 KiB + 22 bytes). */
function findEocd(buffer) {
  const start = Math.max(0, buffer.length - 22 - 0xffff)
  for (let i = buffer.length - 22; i >= start; i -= 1) {
    if (buffer.readUInt32LE(i) !== SIG_EOCD) continue
    const commentLength = buffer.readUInt16LE(i + 20)
    if (i + 22 + commentLength === buffer.length) return i
  }
  return -1
}

/** Normalize one zip entry path to a safe relative path, or null to reject. */
function safeEntryName(rawName) {
  if (typeof rawName !== 'string' || rawName.length === 0) return null
  if (rawName.includes('\0')) return null
  // Treat backslashes as separators too (Windows-made archives).
  const parts = rawName.split(/[\\/]/).filter((part) => part !== '' && part !== '.')
  if (parts.length === 0) return null
  for (const part of parts) {
    if (part === '..') return null
    // Drive letters / UNC roots must not leak out of the extraction root.
    if (/^[a-zA-Z]:$/.test(part)) return null
  }
  return parts.join('/')
}

/**
 * Read ZIP64 extended-info extra fields. Returns a partial record; absent
 * fields stay null. Only the fields the central-directory entry needs are
 * pulled (uncompressed size, compressed size, local offset).
 */
function readZip64Extra(extra, want) {
  let offset = 0
  while (offset + 4 <= extra.length) {
    const id = extra.readUInt16LE(offset)
    const size = extra.readUInt16LE(offset + 2)
    const bodyStart = offset + 4
    const bodyEnd = bodyStart + size
    if (bodyEnd > extra.length) return {}
    if (id === 0x0001) {
      let p = bodyStart
      const result = {}
      if (want.uncompressed && p + 8 <= bodyEnd) {
        result.uncompressed = Number(extra.readBigUInt64LE(p))
        p += 8
      }
      if (want.compressed && p + 8 <= bodyEnd) {
        result.compressed = Number(extra.readBigUInt64LE(p))
        p += 8
      }
      if (want.offset && p + 8 <= bodyEnd) {
        result.offset = Number(extra.readBigUInt64LE(p))
      }
      return result
    }
    offset = bodyEnd
  }
  return {}
}

/**
 * Extract a zip archive into `destination` (created if missing).
 *
 * @param {Buffer} buffer   - whole archive bytes.
 * @param {string} destination - absolute extraction root (must already be
 *   verified to live inside the workspace).
 * @param {{ maxBytes?: number, maxEntries?: number }} [limits] - override caps.
 * @returns {Promise<{ files: string[], skipped: { name: string, reason: string }[], bytes: number }>}
 * @throws on corrupt structure, or when caps are exceeded.
 */
export async function extractZip(buffer, destination, limits = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw new Error('Empty or invalid ZIP archive.')
  }
  const maxBytes = limits.maxBytes ?? MAX_EXTRACT_BYTES
  const maxEntries = limits.maxEntries ?? MAX_EXTRACT_ENTRIES

  const eocd = findEocd(buffer)
  if (eocd < 0) throw new Error('Not a ZIP archive: end-of-central-directory record not found.')

  let entryCount = buffer.readUInt16LE(eocd + 10)
  let cdSize = buffer.readUInt32LE(eocd + 12)
  let cdOffset = buffer.readUInt32LE(eocd + 16)

  // ZIP64 fallback: the 32-bit fields saturate to 0xffffffff.
  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    if (eocd >= 20 && buffer.readUInt32LE(eocd - 20) === SIG_EOCD64_LOC) {
      const eocd64Offset = Number(buffer.readBigUInt64LE(eocd - 12))
      if (eocd64Offset >= 0 && eocd64Offset + 56 <= buffer.length
        && buffer.readUInt32LE(eocd64Offset) === SIG_EOCD64) {
        entryCount = Number(buffer.readBigUInt64LE(eocd64Offset + 32))
        cdSize = Number(buffer.readBigUInt64LE(eocd64Offset + 40))
        cdOffset = Number(buffer.readBigUInt64LE(eocd64Offset + 48))
      }
    }
  }

  if (!Number.isSafeInteger(cdOffset) || !Number.isSafeInteger(cdSize)
    || cdOffset < 0 || cdSize < 0 || cdOffset + cdSize > buffer.length) {
    throw new Error('ZIP central directory lies outside the archive.')
  }

  const root = resolve(destination)
  const rootBoundary = `${root}${sep}`
  const files = []
  const skipped = []
  let totalBytes = 0
  let cursor = cdOffset

  // Directory creation is cached: real archives (installers, node_modules)
  // contain thousands of files but only hundreds of directories, and each
  // file currently paid for its own recursive mkdir + writeFile serially.
  const createdDirs = new Set()
  async function ensureDir(dirPath) {
    if (dirPath === root || createdDirs.has(dirPath)) return
    createdDirs.add(dirPath)
    await mkdir(dirPath, { recursive: true })
  }

  // Writes are batched and flushed concurrently (bounded memory: the batch
  // holds at most WRITE_BATCH files or WRITE_BATCH_BYTES of decompressed
  // data), instead of one await writeFile per entry.
  const WRITE_BATCH = 64
  const WRITE_BATCH_BYTES = 8 * 1024 * 1024
  let writeBatch = []
  let writeBatchBytes = 0
  async function flushWrites() {
    if (!writeBatch.length) return
    const jobs = writeBatch
    writeBatch = []
    writeBatchBytes = 0
    await Promise.all(jobs.map(async ({ targetPath, output }) => {
      await ensureDir(dirname(targetPath))
      await writeFile(targetPath, output)
    }))
  }

  for (let index = 0; index < entryCount; index += 1) {
    if (index >= maxEntries) throw new ZipExtractError('ENTRY_LIMIT', `ZIP entry count exceeds the ${maxEntries} limit.`)
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIG_CENTRAL) {
      throw new Error('ZIP central directory is corrupt.')
    }

    const flags = buffer.readUInt16LE(cursor + 8)
    const method = buffer.readUInt16LE(cursor + 10)
    let compressedSize = buffer.readUInt32LE(cursor + 20)
    let uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    let localOffset = buffer.readUInt32LE(cursor + 42)
    const externalAttrs = buffer.readUInt32LE(cursor + 38)

    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength)
    const extra = buffer.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength)
    cursor += 46 + nameLength + extraLength + commentLength

    const z64 = readZip64Extra(extra, {
      uncompressed: uncompressedSize === 0xffffffff,
      compressed: compressedSize === 0xffffffff,
      offset: localOffset === 0xffffffff,
    })
    if (uncompressedSize === 0xffffffff && z64.uncompressed !== undefined) uncompressedSize = z64.uncompressed
    if (compressedSize === 0xffffffff && z64.compressed !== undefined) compressedSize = z64.compressed
    if (localOffset === 0xffffffff && z64.offset !== undefined) localOffset = z64.offset

    // General-purpose bit 11 = UTF-8 names; otherwise fall back to latin-1.
    const rawName = (flags & 0x0800) !== 0
      ? nameBytes.toString('utf8')
      : nameBytes.toString('latin1')
    const safeName = safeEntryName(rawName)

    if (safeName === null) {
      skipped.push({ name: rawName.slice(0, 200), reason: 'unsafe path' })
      continue
    }

    // Directory entry: name ends with a slash.
    if (rawName.endsWith('/') || rawName.endsWith('\\')) {
      await ensureDir(join(root, ...safeName.split('/')))
      continue
    }

    // Unix symlink (S_IFLNK = 0xA000): never materialize links.
    if (((externalAttrs >>> 16) & 0xf000) === 0xa000) {
      skipped.push({ name: safeName, reason: 'symlink' })
      continue
    }
    // Encrypted entry (general-purpose bit 0).
    if ((flags & 0x0001) !== 0) {
      skipped.push({ name: safeName, reason: 'encrypted' })
      continue
    }

    if (!Number.isSafeInteger(localOffset) || localOffset < 0 || localOffset + 30 > buffer.length
      || buffer.readUInt32LE(localOffset) !== SIG_LOCAL) {
      skipped.push({ name: safeName, reason: 'missing local header' })
      continue
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataStart < 0 || dataEnd > buffer.length) {
      skipped.push({ name: safeName, reason: 'entry data out of bounds' })
      continue
    }
    const compressed = buffer.subarray(dataStart, dataEnd)

    let output
    if (method === 0) {
      output = compressed
    } else if (method === 8) {
      try {
        output = inflateRawSync(compressed)
      } catch {
        skipped.push({ name: safeName, reason: 'invalid deflate data' })
        continue
      }
    } else {
      skipped.push({ name: safeName, reason: `unsupported method ${method}` })
      continue
    }

    if (uncompressedSize !== 0 && output.length !== uncompressedSize) {
      skipped.push({ name: safeName, reason: 'size mismatch' })
      continue
    }
    totalBytes += output.length
    if (totalBytes > maxBytes) throw new ZipExtractError('SIZE_LIMIT', `Extracted size exceeds the ${maxBytes} byte limit.`)

    const targetPath = join(root, ...safeName.split('/'))
    if (targetPath !== root && !targetPath.startsWith(rootBoundary)) {
      skipped.push({ name: safeName, reason: 'escapes extraction root' })
      continue
    }
    writeBatch.push({ targetPath, output })
    writeBatchBytes += output.length
    if (writeBatch.length >= WRITE_BATCH || writeBatchBytes >= WRITE_BATCH_BYTES) {
      await flushWrites()
    }
    files.push(safeName)
  }

  await flushWrites()
  return { files, skipped, bytes: totalBytes }
}
