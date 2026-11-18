/**
 * Reference anchoring for the composer write-back.
 *
 * The host accepts a semantic draft `{ text, references }` only when every
 * reference is a *true* sub-slice of the text: `length === clipboardText.length`,
 * `text.slice(offset, offset + length) === clipboardText`, offsets ascending and
 * non-overlapping, all of them after a leading slash-command token. Anything else
 * is rejected by the host's snapshot schema, and a persisted draft that fails that
 * schema is silently dropped — which is exactly how file chips "degrade" into
 * plain `@path` characters after a rewrite.
 *
 * The rewriter also sees the chips as ordinary characters, so it tends to keep
 * `@path` in the body. Anchoring by `clipboardText` rather than by a fixed offset
 * therefore does two things at once: the chip is re-attached where the path
 * actually ended up, and a path the model dropped is appended once at the tail
 * instead of duplicating the visible `@path`.
 *
 * The same logic is mirrored verbatim in `lib/reference-anchor.js` (the ESM copy
 * the unit tests import) and inlined into `lib/client.js` (the bundle that ships).
 * Keep the three in step.
 * @module dsh-prompt-forge/client/reference-anchor
 */

/** One chip record in the shape the host schema accepts. */
export interface AnchorReference {
  /** Chip kind discriminator, e.g. `file`. */
  source: string
  /** Opaque reference id understood by the host. */
  ref: string
  /** Start offset inside the draft text. */
  offset: number
  /** Span length; always `clipboardText.length`. */
  length: number
  /** Human label the host renders. */
  label: string
  /** Optional rendering hint. */
  appearance?: 'session' | 'file' | 'folder'
  /** The exact characters this chip contributes to the draft text. */
  clipboardText: string
}

/** A text plus the chip records that are provably valid for it. */
export interface PlannedDraft {
  text: string
  references: AnchorReference[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** All non-overlapping occurrences of `needle` in `haystack`. */
export function allIndexes(haystack: string, needle: string): number[] {
  const found: number[] = []
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
 *
 * `clipboardText` is authoritative when present; otherwise the original draft
 * (`sourceText`) supplies the characters at the recorded span. A record that
 * yields no characters at all cannot be anchored and is dropped, as is a stale
 * `invalid` marker — invalidity is re-derived by the validator, never carried.
 */
export function cleanReference(value: unknown, sourceText?: string): AnchorReference | undefined {
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
  const record: AnchorReference = {
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
export function cleanReferences(values: readonly unknown[], sourceText?: string): AnchorReference[] {
  const records: AnchorReference[] = []
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
export function validateDraft(text: string, references: readonly AnchorReference[]): PlannedDraft | undefined {
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

/** One span inside the working text, claimed by a chip. */
interface Span {
  start: number
  end: number
}

/** Every spelling that may stand for one chip in rewritten prose, best first. */
function tokenVariants(record: AnchorReference): string[] {
  const variants: string[] = []
  const push = (value: string): void => {
    if (value !== '' && !variants.includes(value)) variants.push(value)
  }
  push(record.clipboardText)
  if (record.clipboardText.startsWith('@')) push(record.clipboardText.slice(1))
  push(record.label)
  if (record.label.startsWith('@')) push(record.label.slice(1))
  return variants
}

function overlaps(start: number, end: number, claimed: readonly Span[]): boolean {
  for (const span of claimed) if (start < span.end && span.start < end) return true
  return false
}

/** First unclaimed hit for `token` that is not a fragment of a longer path. */
function findFreeSpan(text: string, token: string, claimed: readonly Span[]): number {
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
 * Re-anchor chips inside a rewritten text.
 *
 * Each chip is located by its `clipboardText` characters first, then by the
 * spellings a rewriter commonly normalises it into: the bare path without the
 * leading `@`, or the chip label. A hit on a stunted spelling is rewritten back
 * to `clipboardText` in place, so the chip keeps its position and look even when
 * the model dropped the `@`. A path the model removed entirely is appended at
 * the tail, once. Surplus copies of a path beyond the number of chips asking for
 * it are removed, which is what stops the "one reference becomes two"
 * duplication (body `@path` + trailing chip).
 * @param nextText - the rewritten draft text.
 * @param references - the live chip records captured before the call.
 * @param sourceText - the pre-call draft, used when a record lacks clipboardText.
 */
export function planAnchoredDraft(
  nextText: string,
  references: readonly unknown[],
  sourceText?: string,
): PlannedDraft | undefined {
  const records = cleanReferences(references, sourceText)
  if (records.length === 0) return { text: nextText, references: [] }
  const wanted = new Map<string, number>()
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
  const claimed: Span[] = []
  const claims: { span: Span; record: AnchorReference }[] = []
  const pending: AnchorReference[] = []
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
  const placed: AnchorReference[] = []
  let out = ''
  let cursor = 0
  const emit = (record: AnchorReference): void => {
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
 * Restore mode for undo: the text and the recorded offsets belong together, so
 * the spans are kept as recorded and only validated. A snapshot that does not
 * match (legacy `offset = text.length` records, or a draft edited in between)
 * returns undefined and the caller writes plain text instead.
 */
export function planRestoredDraft(
  text: string,
  references: readonly unknown[],
  sourceText?: string,
): PlannedDraft | undefined {
  const records = cleanReferences(references, sourceText ?? text)
  if (records.length === 0) return { text, references: [] }
  return validateDraft(text, records)
}
