/**
 * The composer enhance button (conversation.input.right): reads the live
 * draft through the session standard kit, applies every local guard
 * (empty / over-length / images-only / command-or-reference chips / busy),
 * then calls the host route.
 *
 * Interaction model (v0.4, WorkBuddy-style in-place rewrite):
 * - A successful enhancement is written straight back into the composer. No
 *   blocking preview modal: the button spins in place while the call runs,
 *   the draft is only touched once the result is normalized and complete.
 * - The button then turns into a revert trigger: clicking it while the
 *   composer still holds the applied text restores the original draft. The
 *   dock undo bar stays as the second, always-visible path to the same entry.
 * - The preview panel is kept, but demoted to two cases only: an error
 *   (which must be visible somewhere), and a result whose draft changed
 *   under it during the call (auto-applying would silently swallow the
 *   user's newer edits).
 * - Clicking the spinner cancels the in-flight request; the draft has not
 *   been touched at that point, so a cancel is a true no-op.
 * @module dsh-prompt-forge/client/EnhanceButton
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputState } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { EnhanceError } from '../shared/protocol'
import { checkInputText } from '../shared/validate'
import { EnhanceClientError, requestEnhance, requestEnhanceStream } from './enhance-client'
import { ResultPanel } from './ResultPanel'
import * as ui from './ui-state'
import { getClientSettings, subscribeClientSettings } from './settings'
import { useSessionKey, serverSessionId } from './session-key'

/** Props of the input.right entry: the InputZone owner share + session kit + locale seat. */
export type EnhanceButtonProps = PropsRuntime<'conversation.input.right'> & PropsLocale<'prompt-forge'>

/**
 * Read the length of an optional array-shaped field out of the host's input
 * state.
 *
 * Attachment ids are part of the conversation input snapshot in the dsh lines
 * this plugin targets, but the field was RENAMED between generations
 * (`imageIds` on the 0.1.x line, `attachmentIds` from 0.2.0 on) and a slot host
 * is not obliged to expose either. Reading `.length` off a missing field throws
 * *during render* — which React answers by unmounting the whole slot entry
 * behind its error boundary, so the composer loses the button and the console
 * fills with a stack trace instead of a usable feature. Reading defensively
 * turns an absent or malformed field into "no such count", which only disables
 * the corresponding advisory guard; the enhancement itself still runs.
 * @param value - the untrusted field.
 * @returns the array length, or 0 when the field is absent/not an array.
 */
function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

/**
 * Read a field that downstream code requires to be a string. `draft` drives
 * `checkInputText`, which iterates the text — an absent field would throw on
 * click instead of on render, but it is the same class of brittleness against
 * an unknown host state shape.
 * @param value - the untrusted field.
 * @returns the string, or `''` when the field is absent/not a string.
 */
function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Stable empty array: `useInput` selectors must not return a fresh array. */
const EMPTY_REFERENCES: readonly unknown[] = []

/** One composer's enhance trigger. */
export function EnhanceButton(props: EnhanceButtonProps): ReactNode {
  const { t, sessionId, useInput, inputActions } = props
  // 0.1.1-rc.2 carries sessionId on the props; 0.1.2-rc.1 dropped it. Use the
  // host id for UI keying when present, else a stable per-mount fallback.
  const uiKey = useSessionKey(sessionId, inputActions)
  const wireId = serverSessionId(sessionId)
  const draft = useInput((state: InputState) => stringOf((state as { draft?: unknown }).draft))
  const phase = useInput((state: InputState) => (state as { phase?: unknown }).phase)
  /**
   * The reference / command chips the draft carries, read as DATA rather than
   * as a count.
   *
   * A chip is a structured editor node, not characters: the composer's plain
   * text projection simply does not contain it. Writing a bare string back via
   * `setDraft` therefore destroyed every chip, which is why earlier versions
   * refused a draft containing one. `setDraft` also accepts
   * `{ text, references }`, so the chips survive the rewrite as long as their
   * records are handed back with the new text.
   */
  const occurrences = useInput((state: InputState) => {
    const raw = (state as { occurrences?: unknown }).occurrences
    return Array.isArray(raw) ? raw : EMPTY_REFERENCES
  })
  const occurrenceCount = occurrences.length
  // `attachmentIds` is the 0.2.x field; `imageIds` is its 0.1.x predecessor.
  // Both are read defensively so one binary serves both generations.
  const attachmentCount = useInput((state: InputState) => {
    const record = state as { attachmentIds?: unknown; imageIds?: unknown }
    return countOf(record.attachmentIds) + countOf(record.imageIds)
  })
  const settings = useSyncExternalStore(subscribeClientSettings, getClientSettings)
  const panel = useSyncExternalStore(ui.subscribe, ui.getPanel)
  const getUndo = useCallback(() => ui.peekUndo(uiKey), [uiKey])
  const undoEntry = useSyncExternalStore(ui.subscribe, getUndo)
  // Set when the preview panel had to be opened for a result that arrived
  // after the draft changed; cleared on apply/cancel.
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rootRef = useRef<HTMLButtonElement | null>(null)
  const busy = panel !== undefined && panel.sessionId === uiKey && panel.phase === 'loading'
  // The composer is holding exactly the text this button wrote into it, and
  // that text has not been edited since: the next click reverts instead of
  // enhancing again. Compared by value, never by "an undo entry exists" — the
  // user may have edited past the applied text, in which case reverting would
  // destroy the newer work.
  const canRevert = undoEntry !== undefined && draft === undoEntry.applied && draft !== ''
  // The preview panel is a single shared slot, so the UI admits exactly ONE
  // in-flight enhancement at a time across all sessions: `anyBusy` disables
  // every other composer's button while one request is loading. This is
  // deliberately stricter than the host `maxConcurrent` cap (default 2) —
  // that cap protects the /enhance command plane and multi-client callers,
  // while the single-panel UI cannot show two loading states anyway.
  const anyBusy = panel !== undefined && panel.phase === 'loading'
  // The OTHER composer is the one loading. See the button render below: a
  // cross-session busy state used to disable this button with no explanation,
  // which reads as "broken" in a multi-session layout.
  const otherBusy = anyBusy && !busy

  /** Guard chain + fetch for this session. On success the result is applied
   * in place by the settle effect below, not here. */
  const start = useCallback((): void => {
    if (anyBusy) return
    setConfirmOpen(false)
    if (!settings.enabled) {
      const disabled = t('error.disabled')
      ui.openError(uiKey, draft, { code: 'rejected', localized: disabled })
      return
    }
    // An empty composer stays completely silent (v0.5). It used to open an
    // error panel reading "the input box is empty — type a prompt to enhance
    // first", which is pure noise: the user can see the box is empty and asked
    // for nothing. The one case that still explains itself is attachments with
    // no text — there the button refuses for a reason the composer does not
    // show on its face.
    if (draft.trim() === '') {
      if (attachmentCount > 0 || occurrenceCount > 0) {
        const attachmentsOnly = t('error.attachmentsOnly')
        ui.openError(uiKey, draft, { code: 'rejected', localized: attachmentsOnly })
      }
      return
    }
    const check = checkInputText(draft, settings.maxInputChars)
    if (!check.ok) {
      const message = check.code === 'empty'
        ? t('error.empty')
        : t('error.tooLong', { count: check.count, max: check.max })
      ui.openError(uiKey, draft, { code: 'rejected', localized: message })
      return
    }
    // A draft carrying reference or command chips is enhanced with those chips
    // preserved. The earlier version refused it outright ("remove them first"),
    // because a plain-string write back would have destroyed them — but the
    // composer accepts a semantic document, so the chips ride along (see
    // `writeDraft` below) and the restriction is gone.
    if (phase !== 'plain') {
      const busyPhase = t('error.phase')
      ui.openError(uiKey, draft, { code: 'rejected', localized: busyPhase })
      return
    }
    const controller = new AbortController()
    ui.openLoading({ sessionId: uiKey, original: draft, abort: () => controller.abort() })
    const settle = (result: Parameters<typeof ui.settleResult>[1]): void => ui.settleResult(uiKey, result)
    const fail = (error: unknown): void => {
      const detail: EnhanceError = error instanceof EnhanceClientError
        ? error.detail
        : { code: 'internal', message: error instanceof Error ? error.message : String(error) }
      ui.settleError(uiKey, detail)
    }
    // Progressive display when enabled: the panel fills in as the model
    // writes, and degrades to the one-shot call on its own when the host or
    // the transport cannot stream. In the in-place model the streamed text is
    // not shown (there is no panel), but streaming still shortens the wait
    // before the first byte and keeps the cancel path identical.
    if (settings.streaming) {
      requestEnhanceStream({ sessionId: wireId, text: draft }, {
        signal: controller.signal,
        onDelta: (delta: string): void => ui.appendDelta(uiKey, delta),
      }).then(settle, fail)
      return
    }
    requestEnhance({ sessionId: wireId, text: draft }, controller.signal).then(settle, fail)
  }, [anyBusy, draft, attachmentCount, occurrenceCount, phase, settings, uiKey, wireId, t])

  // The session registry holds a stable identity; run always dispatches to
  // the latest start callback. The refresh rides an effect (never the render
  // phase, which is unsafe under React 18 concurrent rendering).
  const runRef = useRef(start)
  useEffect(() => {
    runRef.current = start
  })
  useEffect(() => {
    const entry: ui.SessionEntry = {
      root: rootRef.current,
      run: () => runRef.current(),
    }
    return ui.registerSession(uiKey, entry)
  }, [uiKey])

  // Draft changed after the request started → flag (or clear) the result
  // panel's stale marker so the user knows the result is based on the
  // pre-enhance text.
  useEffect(() => {
    if (panel !== undefined && panel.sessionId === uiKey && panel.phase === 'result') {
      ui.setStale(uiKey, draft !== panel.original)
    }
  }, [draft, panel, uiKey])

  /**
   * Write one draft back into the composer, carrying its chip records with it.
   *
   * The host's `setDraft` accepts either a plain string or a semantic document
   * `{ text, references }`; only the document form survives reference and
   * command chips, so the string form is used solely when there are none.
   *
   * Chip offsets are measured against the draft text, and the rewritten text
   * has a different length — so a rewritten draft re-anchors every chip at the
   * END of the new text. That is the only offset guaranteed to be in range, and
   * it keeps each reference valid (the chips stay as a trailing group). A
   * restore passes `keepOffsets` because the original text and the original
   * chip offsets still belong together.
   * @param text - the draft text to write.
   * @param references - the chips to keep, if any.
   * @param keepOffsets - restore the chips at their recorded offsets.
   */
  const writeDraft = useCallback((text: string, references?: readonly unknown[], keepOffsets = false): void => {
    const setDraft = inputActions.setDraft as unknown as (value: unknown) => void
    if (references === undefined || references.length === 0) {
      setDraft(text)
      return
    }
    const placed = keepOffsets
      ? references
      : references.map((entry) => ({ ...(entry as Record<string, unknown>), offset: text.length }))
    setDraft({ text, references: placed })
  }, [inputActions])

  // The in-place apply. Runs when this session's request settles with a
  // result: remember the pre-apply draft (so undo restores exactly what the
  // composer held), write the enhanced text back, and drop the loading state.
  //
  // Two deliberate exceptions, both falling back to the panel:
  // - the draft no longer equals the text the call started from → the user
  //   typed while the model was working; overwriting would destroy that, so
  //   the panel asks first;
  // - the result is empty → nothing to write, let the panel report it.
  useEffect(() => {
    if (panel === undefined || panel.sessionId !== uiKey) return
    if (panel.phase !== 'result' || panel.result === undefined) return
    const enhanced = panel.result.text
    if (draft !== panel.original || enhanced === '') {
      setConfirmOpen(true)
      return
    }
    ui.pushUndo(uiKey, { original: draft, applied: enhanced, originalReferences: occurrences })
    writeDraft(enhanced, occurrences)
    ui.closePanel()
  }, [draft, occurrences, panel, uiKey, writeDraft])

  /** Apply the enhanced result from the panel: remember the CURRENT draft
   * (pre-apply, so undo restores exactly this state even if the user typed
   * during the request), then fill the enhanced text back. */
  const apply = useCallback((): void => {
    if (panel === undefined || panel.phase !== 'result' || panel.result === undefined) return
    ui.pushUndo(uiKey, { original: draft, applied: panel.result.text, originalReferences: occurrences })
    writeDraft(panel.result.text, occurrences)
    setConfirmOpen(false)
    ui.closePanel()
  }, [draft, occurrences, panel, uiKey, writeDraft])

  /** Click dispatch: cancel while loading → revert while reverting is safe →
   * otherwise start a fresh enhancement. */
  const onClick = useCallback((): void => {
    if (busy) {
      // Nothing has been written to the composer yet, so cancelling is a
      // true no-op: drop the loading state and abort the request.
      ui.closePanel()
      return
    }
    if (canRevert && undoEntry !== undefined) {
      writeDraft(undoEntry.original, undoEntry.originalReferences, true)
      ui.popUndo(uiKey)
      ui.closePanel()
      return
    }
    start()
  }, [busy, canRevert, undoEntry, uiKey, start, writeDraft])

  if (!settings.enabled) return null

  const owned = panel !== undefined && panel.sessionId === uiKey ? panel : undefined
  // Only these two states still warrant the panel; a plain success is applied
  // in place and never opens one.
  const showPanel = owned !== undefined && (owned.phase === 'error' || (owned.phase === 'result' && confirmOpen))
  const icon = canRevert ? '↩' : '✨'
  // The busy state is a real drawn ring, not the `◌` glyph: a Unicode circle
  // is rendered by whatever font the host happens to use, and several of them
  // draw it as an ellipse, which then reads as a broken spinner when rotated.
  const glyph = busy ? <span className="dsh-pf-spinner" aria-hidden /> : icon
  const title = busy
    ? t('button.cancelBusy')
    : canRevert
      ? t('button.revert')
      : otherBusy
        ? t('button.otherBusy')
        : t('button.title')
  return (
    <>
      <button
        ref={rootRef}
        type="button"
        className={`dsh-pf-btn${busy ? ' is-busy' : ''}${canRevert ? ' is-revert' : ''}`}
        title={title}
        aria-label={title}
        // `aria-disabled` instead of `disabled`: a disabled button is skipped by
        // the keyboard and by screen readers, so the reason this composer is
        // inert (another session's enhancement occupies the single preview
        // panel) would be unreachable exactly for the users who need it. The
        // click is a no-op either way (`start` returns early on `anyBusy`).
        aria-disabled={otherBusy || undefined}
        onClick={onClick}
      >
        <span className="dsh-pf-btn-icon" aria-hidden>{glyph}</span>
      </button>
      {showPanel && owned !== undefined && (
        createPortal(
          <ResultPanel
            state={owned}
            t={t}
            onApply={apply}
            onCancel={() => {
              setConfirmOpen(false)
              ui.closePanel()
            }}
            onRetry={owned.phase === 'error' ? start : undefined}
          />,
          document.body,
        )
      )}
    </>
  )
}
