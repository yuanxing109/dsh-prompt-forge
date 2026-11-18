/**
 * Runtime mirror of `src/client/reference-anchor.ts`.
 *
 * The package ships without a test runner, so the unit tests import this ESM
 * copy directly (`node --test test/`). The shipped bundle `lib/client.js`
 * carries the same functions inline. Keep the three in step; this file is
 * deliberately typed-free but otherwise identical.
 */

function isRecord(value) {
  return typeof value === 'object' && value !== null
}

/** All non-overlapping occurrences of `needle` in `haystack`. */
export function allIndexes(haystack, needle) {
  const found = []
  if (needle === '') return found
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) return found
    found.push(at)
    from = at + needle.length
  }
}

/**
 * Coerce one live/persisted chip record into schema shape.
 * `clipboardText` is authoritative when present; otherwise the original draft
 * supplies the characters at the recorded span. A stale `invalid` marker is
 * dropped on purpose: invalidity is re-derived by the validator.
 */
export function cleanReference(value, sourceText) {
  if (!isRecord(value)) return undefined
  const source = typeof value.source === 'string' ? value.source : ''
  const ref = typeof value.ref === 'string' ? value.ref : ''
  if (source === '' && ref === '') return undefined
  const rawOffset = typeof value.offset === 'number' && Number.isInteger(value.offset) ? value.offset : -1
  const rawLength = typeof value.length === 'number' && Number.isInteger(value.length) ? value.length : -1
  let clipboardText = typeof value.clipboardText === 'string' ? value.clipboardText : ''
  if (clipboardText === '' && sourceText !== undefined && rawOffset >= 0 && rawLength > 0) {
    clipboardText = sourceText.slice(rawOffset, rawOffset + rawLength)
  }
  if (clipboardText === '') return undefined
  const record = {
    source,
    ref,
    offset: rawOffset >= 0 ? rawOffset : 0,
    length: clipboardText.length,
    label: typeof value.label === 'string' && value.label !== '' ? value.label : clipboardText,
    clipboardText,
  }
  const appearance = value.appearance
  if (appearance === 'session' || appearance === 'file' || appearance === 'folder') {
    record.appearance = appearance
  }
  return record
}

/** Clean a live chip list; records without characters are dropped. */
export function cleanReferences(values, sourceText) {
  const records = []
  for (const value of values) {
    const record = cleanReference(value, sourceText)
    if (record !== undefined) records.push(record)
  }
  return records
}

/**
 * Validate a planned draft against the host invariants (snapshotSchema.refine).
 * Returns undefined when the plan cannot be written as a semantic draft.
 */
export function validateDraft(text, references) {
  const ordered = [...references].sort((left, right) => left.offset - right.offset)
  let previousEnd = 0
  for (const record of ordered) {
    if (record.length <= 0 || record.length !== record.clipboardText.length) return undefined
    if (record.offset < previousEnd) return undefined
    const end = record.offset + record.length
    if (end > text.length) return undefined
    if (text.slice(record.offset, end) !== record.clipboardText) return undefined
    previousEnd = end
  }
  if (text.startsWith('/')) {
    const token = /^\/\S+\s/.exec(text)
    if (token !== null) {
      const tokenEnd = token[0].length
      for (const record of ordered) if (record.offset < tokenEnd) return undefined
    }
  }
  return { text, references: ordered }
}

/** Characters that may extend a path-like token, used to reject partial hits. */
const PATH_TAIL = /[A-Za-z0-9_./-]/

/** Every spelling that may stand for one chip in rewritten prose, best first. */
function tokenVariants(record) {
  const variants = []
  const push = (value) => {
    if (value !== '' && !variants.includes(value)) variants.push(value)
  }
  push(record.clipboardText)
  if (record.clipboardText.startsWith('@')) push(record.clipboardText.slice(1))
  push(record.label)
  if (record.label.startsWith('@')) push(record.label.slice(1))
  return variants
}

function overlaps(start, end, claimed) {
  for (const span of claimed) if (start < span.end && span.start < end) return true
  return false
}

/** First unclaimed hit for `token` that is not a fragment of a longer path. */
function findFreeSpan(text, token, claimed) {
  if (token === '') return -1
  let from = 0
  for (;;) {
    const at = text.indexOf(token, from)
    if (at === -1) return -1
    const end = at + token.length
    const before = at === 0 ? '' : text[at - 1]
    const after = end >= text.length ? '' : text[end]
    const gluedBefore = !token.startsWith('@') && PATH_TAIL.test(before)
    const gluedAfter = !token.endsWith('/') && PATH_TAIL.test(after)
    if (!gluedBefore && !gluedAfter && !overlaps(at, end, claimed)) return at
    from = at + 1
  }
}

/**
 * Re-anchor chips inside a rewritten text: keep each chip on the characters the
 * model preserved (or on the bare path it normalised to), drop surplus copies,
 * append a dropped path once at the tail.
 */
export function planAnchoredDraft(nextText, references, sourceText) {
  const records = cleanReferences(references, sourceText)
  if (records.length === 0) return { text: nextText, references: [] }
  const wanted = new Map()
  for (const record of records) {
    wanted.set(record.clipboardText, (wanted.get(record.clipboardText) ?? 0) + 1)
  }
  let text = nextText
  for (const [token, keep] of wanted) {
    const found = allIndexes(text, token)
    for (let index = found.length - 1; index >= keep; index -= 1) {
      text = text.slice(0, found[index]) + text.slice(found[index] + token.length)
    }
  }
  const claimed = []
  const claims = []
  const pending = []
  for (const record of records) {
    let hit = -1
    let hitToken = ''
    for (const token of tokenVariants(record)) {
      hit = findFreeSpan(text, token, claimed)
      if (hit !== -1) {
        hitToken = token
        break
      }
    }
    if (hit === -1) {
      pending.push(record)
      continue
    }
    const span = { start: hit, end: hit + hitToken.length }
    claimed.push(span)
    claims.push({ span, record })
  }
  claims.sort((left, right) => left.span.start - right.span.start)
  const placed = []
  let out = ''
  let cursor = 0
  const emit = (record) => {
    placed.push({ ...record, offset: out.length, length: record.clipboardText.length })
    out += record.clipboardText
  }
  for (const claim of claims) {
    out += text.slice(cursor, claim.span.start)
    emit(claim.record)
    cursor = claim.span.end
  }
  out += text.slice(cursor)
  for (const record of pending) {
    const separator = out === '' || /\s$/.test(out) ? '' : ' '
    out += separator
    emit(record)
  }
  return validateDraft(out, placed)
}

/**
 * Restore mode for undo: text and recorded offsets belong together, so spans are
 * kept as recorded and only validated. Mismatched snapshots return undefined.
 */
export function planRestoredDraft(text, references, sourceText) {
  const records = cleanReferences(references, sourceText ?? text)
  if (records.length === 0) return { text, references: [] }
  return validateDraft(text, records)
}
