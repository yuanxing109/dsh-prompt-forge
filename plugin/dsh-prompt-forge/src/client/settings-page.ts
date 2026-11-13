/**
 * The plugin's own Settings page (slot `settings.section`, id
 * `prompt-forge`): pick which model performs the enhancement.
 *
 * The preference itself already existed (`provider` + `model` in the plugin
 * config), but it lived in the auto-rendered plugin-config form as two bare
 * text inputs, so choosing a cheap model meant typing a provider id and a
 * model id from memory. This page turns that into a two-way choice —
 * follow the session model, or pin a fixed one picked from the host's own
 * catalog — and states the precedence in the page instead of the README.
 *
 * Written with `createElement` rather than JSX on purpose: this file and the
 * compiled `lib/client.js` copy have to stay byte-comparable, and hand-porting
 * JSX into esbuild's `jsx()` calls is where transcription bugs come from.
 * @module dsh-prompt-forge/client/settings-page
 */

import { createElement as h, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { zh } from './locales'

/** One selectable model in the host catalog. */
export interface CatalogModel {
  readonly id: string
  readonly name: string
}

/** One provider group of the host catalog. */
export interface CatalogProvider {
  readonly id: string
  readonly name: string
  readonly models: readonly CatalogModel[]
}

/** The context-assembly weights, as stored (or as shipped by default). */
export interface ContextWeights {
  /** Budget weight of the two newest turns. */
  readonly recentBoost: number
  /** Budget weight of assistant turns. */
  readonly assistantBoost: number
}

/** The stored enhancement-strategy override. */
export interface StrategyState {
  /** Custom text appended after the built-in strategy; empty means none. */
  readonly custom: string
  /** How `custom` combines with the built-in strategy (`extend-default`). */
  readonly strategyMode: string
}

/**
 * Shipped defaults, mirrored here so the page can render a value for a section
 * that never stored one. The host's `DEFAULT_CONFIG` is the authority; these
 * two numbers must stay in step with it.
 */
const DEFAULT_WEIGHTS: ContextWeights = { recentBoost: 1, assistantBoost: 1 }

/**
 * Soft cap on the custom strategy text. The built-in strategy is ~3400
 * characters and the custom text is APPENDED to it, so this keeps the combined
 * prompt around 8000 — past that, the extra text starts crowding the draft it
 * is supposed to be rewriting.
 */
const CUSTOM_PROMPT_LIMIT = 4000

/** Everything the page needs from the plugin's client context. */
export interface SettingsPageApi {
  /** The stored override, empty strings when the session model is followed. */
  read: () => { provider: string; model: string; writable: boolean }
  /** Observe settings-document changes (own entry and the model catalog). */
  subscribe: (listener: () => void) => () => void
  /** Persist one choice; empty provider+model clears the override. */
  save: (next: { provider: string; model: string }) => Promise<boolean>
  /** The host's provider/model catalog, empty when it cannot be read. */
  catalog: () => readonly CatalogProvider[]
  /** The context-assembly weights currently in effect. */
  readWeights: () => ContextWeights
  /** Persist explicit weights (each clamped to 1–3 by the caller). */
  saveWeights: (recentBoost: number, assistantBoost: number) => Promise<boolean>
  /** Clear both weights so the shipped defaults apply again. */
  resetWeights: () => Promise<boolean>
  /** The custom strategy text and how it is combined with the built-in one. */
  readStrategy: () => StrategyState
  /**
   * Persist the custom strategy text; an empty string clears the override.
   * Always writes `strategyMode: 'extend-default'` — `replace-default` would
   * drop the built-in hard rules (no fabrication, placeholders, output-only),
   * which is the one outcome nobody wants from a "customize the prompt" box.
   */
  saveStrategy: (text: string) => Promise<boolean>
  /** Clear the custom strategy entirely (back to the built-in prompt). */
  resetStrategy: () => Promise<boolean>
  /** Localized copy. */
  t: (key: string) => string
}

/** Namespace of the model-catalog settings entry the host ships. */
const LLM_CATALOG_NAMESPACES = ['llm-pi-ai']

/** Structural face of the config-form objects this page touches. */
interface FormLike {
  getSnapshot?: () => { value?: unknown; writable?: unknown } | undefined
  subscribe?: (listener: () => void) => (() => void) | undefined
  mutate?: (ops: readonly { op: string; path: string[]; value?: unknown }[], revision?: unknown) => Promise<boolean>
}

/** Structural face of `ctx.configForms`. */
interface ConfigFormsLike {
  get?: (entryId: string) => FormLike | undefined
  describe?: () => { subscribe?: (listener: () => void) => (() => void) | undefined } | undefined
}

/**
 * Read `provider` / `model` out of one raw section without trusting its shape.
 * @param value - the untrusted section value.
 * @returns the two strings, empty when absent or not strings.
 */
function overrideOf(value: unknown): { provider: string; model: string } {
  const record = (value !== null && typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    provider: typeof record.provider === 'string' ? record.provider : '',
    model: typeof record.model === 'string' ? record.model : '',
  }
}

/**
 * Project the host's raw catalog value into the page's list shape.
 *
 * The catalog entry is an operator-owned settings document, so nothing about
 * its shape is guaranteed: a renamed field, a provider without `models`, or a
 * half-typed hand edit must all degrade to "fewer options", never to a thrown
 * error inside a settings page (which React answers by unmounting the section
 * and leaving a blank Settings pane).
 * @param value - the untrusted `llm-pi-ai` section value.
 * @returns provider groups that actually carry at least one model.
 */
function catalogOf(value: unknown): readonly CatalogProvider[] {
  const providers = (value !== null && typeof value === 'object' ? (value as Record<string, unknown>).providers : undefined)
  if (providers === null || typeof providers !== 'object') return []
  const out: CatalogProvider[] = []
  for (const [id, raw] of Object.entries(providers as Record<string, unknown>)) {
    if (raw === null || typeof raw !== 'object') continue
    const record = raw as Record<string, unknown>
    const models = Array.isArray(record.models) ? record.models : []
    const projected: CatalogModel[] = []
    for (const entry of models) {
      if (entry === null || typeof entry !== 'object') continue
      const model = entry as Record<string, unknown>
      if (typeof model.id !== 'string' || model.id === '') continue
      projected.push({ id: model.id, name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id })
    }
    if (projected.length === 0) continue
    out.push({ id, name: typeof record.displayName === 'string' && record.displayName !== '' ? record.displayName : id, models: projected })
  }
  return out
}

/**
 * Read one optional service off a cordis context.
 *
 * `ctx.<service>` is a guarded property: reading it without a matching `inject`
 * declaration throws `cannot get property "X" without inject`. This API is
 * built inside a `slots.inject` callback, whose context declares neither
 * `configForms` nor `locale`, so the guarded read is the wrong accessor here —
 * it threw and the whole section registration was abandoned. `ctx.get(name)`
 * is the optional accessor (undefined instead of a throw), and is how the
 * host's own settings shell reaches `productAnalytics`.
 * @param ctx - the context that may carry the service.
 * @param name - the service name.
 * @returns the service, or undefined when it is absent.
 */
function serviceOf<T>(ctx: { get?: (name: string) => unknown }, name: string): T | undefined {
  try {
    const getter = ctx.get
    if (typeof getter === 'function') {
      const value = getter.call(ctx, name) as T | undefined
      if (value !== undefined) return value
    }
  } catch {
    // Guarded context: fall through to the plain property read.
  }
  try {
    return (ctx as unknown as Record<string, T | undefined>)[name]
  } catch {
    return undefined
  }
}

/** Shape of the locale service this page needs. */
interface LocaleLike {
  bind?: (ns: string) => (key: string) => unknown
}

/**
 * Build the page API over one client context.
 * @param ctx - the browser half's context.
 * @returns the API handed to the section component.
 */
export function createSettingsPageApi(ctx: { get?: (name: string) => unknown }): SettingsPageApi {
  const forms = serviceOf<ConfigFormsLike>(ctx, 'configForms')
  const form = forms?.get?.('prompt-forge')
  const read = (): { provider: string; model: string; writable: boolean } => {
    let snapshot: { value?: unknown; writable?: unknown } | undefined
    try {
      snapshot = form?.getSnapshot?.()
    } catch {
      snapshot = undefined
    }
    return { ...overrideOf(snapshot?.value), writable: snapshot?.writable !== false }
  }
  const subscribe = (listener: () => void): (() => void) => {
    const offs: (() => void)[] = []
    try {
      const own = form?.subscribe?.(listener)
      if (typeof own === 'function') offs.push(own)
    } catch {
      // A form that cannot be observed keeps the first snapshot.
    }
    try {
      // The catalog lives in another plugin's entry, so the page follows the
      // shared describe mirror instead of that entry's own form: one
      // subscription covers both "my override changed" and "the catalog
      // changed" without reaching into a foreign form's lifecycle.
      const shared = forms?.describe?.()?.subscribe?.(listener)
      if (typeof shared === 'function') offs.push(shared)
    } catch {
      // Degrade to the own-form subscription.
    }
    return () => {
      for (const off of offs) {
        try {
          off()
        } catch {
          // Already released.
        }
      }
    }
  }
  const save = async (next: { provider: string; model: string }): Promise<boolean> => {
    if (form?.mutate === undefined) return false
    const ops = next.provider !== '' && next.model !== ''
      ? [
          { op: 'set', path: ['provider'], value: next.provider },
          { op: 'set', path: ['model'], value: next.model },
        ]
      : [
          { op: 'unset', path: ['provider'] },
          { op: 'unset', path: ['model'] },
        ]
    try {
      return await form.mutate(ops)
    } catch {
      return false
    }
  }
  const catalog = (): readonly CatalogProvider[] => {
    for (const namespace of LLM_CATALOG_NAMESPACES) {
      try {
        const projected = catalogOf(forms?.get?.(namespace)?.getSnapshot?.()?.value)
        if (projected.length > 0) return projected
      } catch {
        // Try the next candidate namespace.
      }
    }
    return []
  }
  const readWeights = (): ContextWeights => {
    let snapshot: { value?: unknown } | undefined
    try {
      snapshot = form?.getSnapshot?.()
    } catch {
      snapshot = undefined
    }
    const value = (snapshot?.value !== null && typeof snapshot?.value === 'object'
      ? snapshot.value
      : {}) as Record<string, unknown>
    return {
      recentBoost: typeof value.contextRecentBoost === 'number' ? value.contextRecentBoost : DEFAULT_WEIGHTS.recentBoost,
      assistantBoost: typeof value.contextAssistantBoost === 'number' ? value.contextAssistantBoost : DEFAULT_WEIGHTS.assistantBoost,
    }
  }
  const saveWeights = async (recentBoost: number, assistantBoost: number): Promise<boolean> => {
    if (form?.mutate === undefined) return false
    try {
      return await form.mutate([
        { op: 'set', path: ['contextRecentBoost'], value: recentBoost },
        { op: 'set', path: ['contextAssistantBoost'], value: assistantBoost },
      ])
    } catch {
      return false
    }
  }
  /**
   * Clear both weights rather than writing the defaults back: an unset field
   * inherits whatever the shipped default becomes, so a later release that
   * retunes the default also applies here. Writing the current numbers would
   * pin today's values forever.
   */
  const resetWeights = async (): Promise<boolean> => {
    if (form?.mutate === undefined) return false
    try {
      return await form.mutate([
        { op: 'unset', path: ['contextRecentBoost'] },
        { op: 'unset', path: ['contextAssistantBoost'] },
      ])
    } catch {
      return false
    }
  }
  const readStrategy = (): StrategyState => {
    let snapshot: { value?: unknown } | undefined
    try {
      snapshot = form?.getSnapshot?.()
    } catch {
      snapshot = undefined
    }
    const value = (snapshot?.value !== null && typeof snapshot?.value === 'object'
      ? snapshot.value
      : {}) as Record<string, unknown>
    return {
      custom: typeof value.systemPrompt === 'string' ? value.systemPrompt : '',
      strategyMode: typeof value.strategyMode === 'string' ? value.strategyMode : 'replace-default',
    }
  }
  const saveStrategy = async (text: string): Promise<boolean> => {
    if (form?.mutate === undefined) return false
    try {
      if (text.trim() === '') {
        return await form.mutate([
          { op: 'unset', path: ['systemPrompt'] },
          { op: 'unset', path: ['strategyMode'] },
        ])
      }
      return await form.mutate([
        { op: 'set', path: ['systemPrompt'], value: text },
        { op: 'set', path: ['strategyMode'], value: 'extend-default' },
      ])
    } catch {
      return false
    }
  }
  const resetStrategy = async (): Promise<boolean> => saveStrategy('')
  let bound: ((key: string) => unknown) | undefined  try {
    bound = serviceOf<LocaleLike>(ctx, 'locale')?.bind?.('prompt-forge')
  } catch {
    bound = undefined
  }
  const t = (key: string): string => {
    // The locale service is an optional injection and may mount after this API
    // is built, so a miss retries the bind instead of freezing the bundled
    // dictionary for the rest of the session.
    if (bound === undefined) {
      try {
        bound = serviceOf<LocaleLike>(ctx, 'locale')?.bind?.('prompt-forge')
      } catch {
        bound = undefined
      }
    }
    if (bound !== undefined) {
      try {
        const text = bound(key)
        if (typeof text === 'string' && text !== '') return text
      } catch {
        // Fall through to the bundled dictionary.
      }
    }
    const fallback = (zh as unknown as Record<string, string>)[key]
    return fallback !== undefined ? fallback : key
  }
  return {
    read, subscribe, save, catalog,
    readWeights, saveWeights, resetWeights,
    readStrategy, saveStrategy, resetStrategy,
    t,
  }
}

/** One option of the drawn dropdown. */
interface DropdownOption {
  readonly id: string
  readonly name: string
}

/** Props of the drawn dropdown. */
interface DropdownProps {
  readonly value: string
  readonly options: readonly DropdownOption[]
  readonly placeholder: string
  readonly disabled?: boolean
  readonly onChange: (next: string) => void
}

/** Height budget of the open list, used to decide whether it opens upward. */
const MENU_MAX_HEIGHT = 240

/**
 * A dropdown the plugin draws itself, replacing a native `<select>`.
 *
 * The native popup is rendered by the OS: its colours, borders and highlight
 * ignore the page's palette entirely, so in a dark Settings panel it opened as
 * a white sheet with barely visible rows. A drawn list is the only way to make
 * the open state match the closed trigger.
 *
 * The list is portalled to `document.body` and positioned `fixed` from the
 * trigger's rect, for two reasons: the Settings page scrolls (an absolutely
 * positioned list would be clipped by that scroll container), and the panel may
 * sit inside a transformed ancestor (which would break `absolute` offsets).
 */
function Dropdown(props: DropdownProps): unknown {
  const { value, options, placeholder, disabled, onChange } = props
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; bottom: number; left: number; width: number } | undefined>(undefined)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    // `pointerdown` on the BUBBLE phase, not `mousedown` in capture: a capture
    // listener runs before the list item's own handler, so any press that
    // shifted focus could close the menu and swallow the selection. The list
    // item also commits on `mousedown` (see the row render), so selection wins
    // regardless of which phase this runs in.
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (target !== null && menuRef.current !== null && menuRef.current.contains(target)) return
      if (target !== null && triggerRef.current !== null && triggerRef.current.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    // Scrolling closes the list: the anchor is a snapshot, so a scrolled
    // Settings pane would leave the menu floating away from its trigger. The
    // list's OWN scroll must not count, or a long model list would close
    // itself the moment the user scrolls it.
    const onScroll = (event: Event): void => {
      const target = event.target
      if (target instanceof Node && menuRef.current !== null && menuRef.current.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown as EventListener)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown as EventListener)
      document.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const current = options.find((option) => option.id === value)
  const toggle = (): void => {
    if (disabled === true) return
    const rect = triggerRef.current === null ? undefined : triggerRef.current.getBoundingClientRect()
    setAnchor(rect === undefined ? undefined : { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width })
    setOpen(!open)
  }

  const openUp = anchor !== undefined
    && window.innerHeight - anchor.bottom < MENU_MAX_HEIGHT
    && anchor.top > MENU_MAX_HEIGHT

  return h('div', { className: 'dsh-pf-dd' },
    h('button', {
      ref: triggerRef,
      type: 'button',
      className: 'dsh-pf-dd-btn' + (open ? ' is-open' : '') + (current === undefined ? ' is-empty' : ''),
      disabled: disabled === true,
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      onClick: toggle,
    },
      h('span', { className: 'dsh-pf-dd-value' }, current !== undefined ? current.name : placeholder),
      h('span', { className: 'dsh-pf-dd-caret', 'aria-hidden': true })),
    open && anchor !== undefined && createPortal(
      h('div', {
        ref: menuRef,
        className: 'dsh-pf-dd-menu',
        role: 'listbox',
        style: openUp
          ? { bottom: (window.innerHeight - anchor.top + 4) + 'px', left: anchor.left + 'px', minWidth: anchor.width + 'px' }
          : { top: (anchor.bottom + 4) + 'px', left: anchor.left + 'px', minWidth: anchor.width + 'px' },
      },
        options.length === 0 && h('div', { className: 'dsh-pf-dd-empty' }, placeholder),
        options.map((option) => h('button', {
          key: option.id,
          type: 'button',
          role: 'option',
          'aria-selected': option.id === value,
          className: 'dsh-pf-dd-item' + (option.id === value ? ' is-on' : ''),
          // Commit on mousedown: a click can be lost if anything closes the
          // menu first (focus scroll, a host listener). preventDefault keeps
          // the trigger's focus so the menu does not flash.
          onMouseDown: (event: Event) => {
            event.preventDefault()
            onChange(option.id)
            setOpen(false)
          },
          onClick: () => onChange(option.id),
        }, option.name))),
      document.body),
  )
}

/** Props of the registered section: the host passes `close`, the plugin injects the API. */
export interface SettingsSectionProps {
  /** Closes the Settings panel (host-provided). */
  close?: () => void
  api: SettingsPageApi
}

/**
 * Render the 提示词增强 settings page.
 *
 * Layout is deliberately two groups plus a footer bar: the model choice (the
 * only thing this page configures), and the rules that explain when it wins
 * over the session model. The previous version stacked the choice, a duplicate
 * "in effect" line and one dense paragraph of rules all at the same weight,
 * which made a two-option page read like a form with three sections.
 * @param props - host props plus the injected API.
 * @returns the section element.
 */
export function SettingsSection(props: SettingsSectionProps): unknown {
  const { api } = props
  const t = api.t
  const [stored, setStored] = useState(() => api.read())
  // Kept as STRINGS: a number input briefly holds "1." or "" while typing, and
  // writing those through would either fail validation or store NaN.
  const [weightDraft, setWeightDraft] = useState(() => {
    const current = api.readWeights()
    return { recent: String(current.recentBoost), assistant: String(current.assistantBoost) }
  })
  const [strategy, setStrategy] = useState<StrategyState>(() => api.readStrategy())
  const [strategyText, setStrategyText] = useState(() => api.readStrategy().custom)
  const [useCustom, setUseCustom] = useState(() => api.readStrategy().custom.trim() !== '')
  const [catalog, setCatalog] = useState<readonly CatalogProvider[]>(() => api.catalog())
  const [mode, setMode] = useState<'follow' | 'fixed'>(() => (api.read().provider !== '' ? 'fixed' : 'follow'))
  const [provider, setProvider] = useState(() => api.read().provider)
  const [model, setModel] = useState(() => api.read().model)
  const [manual, setManual] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | undefined>(undefined)

  useEffect(() => api.subscribe(() => {
    setStored(api.read())
    const next = api.readWeights()
    setWeightDraft({ recent: String(next.recentBoost), assistant: String(next.assistantBoost) })
    const nextStrategy = api.readStrategy()
    setStrategy(nextStrategy)
    setStrategyText(nextStrategy.custom)
    setUseCustom(nextStrategy.custom.trim() !== '')
    setCatalog(api.catalog())
  }), [api])

  /**
   * Preselect the first provider when none is chosen.
   *
   * The model dropdown is disabled until a provider is chosen, so an empty
   * provider leaves the operator staring at a dead control that offers no
   * explanation. With a single-provider catalog there is nothing to decide;
   * with several, the first is a starting point they can change — either way
   * the form never sits in an unusable empty state.
   */
  useEffect(() => {
    if (mode !== 'fixed' || provider !== '' || catalog.length === 0) return
    const first = catalog[0]
    if (first !== undefined) setProvider(first.id)
  }, [mode, provider, catalog])

  const modelsOf = useMemo(
    () => catalog.find((group) => group.id === provider)?.models ?? [],
    [catalog, provider],
  )
  const useSelects = catalog.length > 0 && !manual
  const dirty = mode === 'follow'
    ? stored.provider !== ''
    : provider !== stored.provider || model !== stored.model
  const pairMissing = mode === 'fixed' && (provider === '' || model === '')
  /** What the plugin will actually use right now: the SAVED value, not the form. */
  const effective = stored.provider !== '' && stored.model !== ''
    ? stored.provider + ' · ' + stored.model
    : t('settings.mode.follow')
  /** Code-point count, matching how the plugin measures every other text. */
  const strategyChars = Array.from(strategyText).length

  /** Persist one choice and report the host's verdict. */  const commit = (next: { provider: string; model: string }): void => {
    setSaving(true)
    setNotice(undefined)
    void api.save(next).then((ok) => {
      setSaving(false)
      setNotice(ok
        ? { ok: true, text: t('settings.saved') }
        : { ok: false, text: t('settings.saveFailed') })
    })
  }

  const onSave = (): void => {
    if (pairMissing) {
      setNotice({ ok: false, text: t('settings.needPair') })
      return
    }
    commit(mode === 'fixed' ? { provider, model } : { provider: '', model: '' })
  }

  /**
   * Reset AND commit in one step. The earlier version only reset the form
   * state, so the label read like an action while the stored setting stayed put
   * until a second click on Save.
   */
  const onReset = (): void => {
    setMode('follow')
    setProvider('')
    setModel('')
    commit({ provider: '', model: '' })
  }

  /**
   * Clear both weights so the shipped defaults apply again. One click, no
   * confirm step: the operation only removes an override, and the resulting
   * values are shown immediately below it.
   */
  /**
   * Write the custom strategy text, committed on blur like the weights: a
   * half-typed sentence must not reach the settings document.
   */
  const commitStrategy = (text: string): void => {
    if (text === api.readStrategy().custom) return
    setSaving(true)
    setNotice(undefined)
    void api.saveStrategy(text).then((ok) => {
      setSaving(false)
      setNotice(ok
        ? { ok: true, text: t('settings.strategy.saved') }
        : { ok: false, text: t('settings.strategy.resetFailed') })
    })
  }

  /**
   * Pick built-in or custom. Choosing built-in IS the change, so it commits
   * immediately instead of waiting for a save click this group does not have.
   */
  const pickStrategy = (custom: boolean): void => {
    setUseCustom(custom)
    setNotice(undefined)
    if (!custom) {
      setStrategyText('')
      commitStrategy('')
    }
  }

  const onResetStrategy = (): void => {
    setUseCustom(false)
    setStrategyText('')
    if (api.readStrategy().custom === '') {
      setNotice({ ok: true, text: t('settings.strategy.resetDone') })
      return
    }
    setSaving(true)
    setNotice(undefined)
    void api.resetStrategy().then((ok) => {
      setSaving(false)
      setNotice(ok
        ? { ok: true, text: t('settings.strategy.resetDone') }
        : { ok: false, text: t('settings.strategy.resetFailed') })
    })
  }

  /**
   * Write the two weights, committed on blur rather than on each keystroke: a
   * number input passes through half-typed values ("1.", "") that must never
   * reach the settings document.
   */
  const commitWeights = (): void => {
    const recent = Number(weightDraft.recent)
    const assistant = Number(weightDraft.assistant)
    const current = api.readWeights()
    if (recent === current.recentBoost && assistant === current.assistantBoost) return
    if (!Number.isFinite(recent) || recent < 1 || recent > 3
      || !Number.isFinite(assistant) || assistant < 1 || assistant > 3) {
      setNotice({ ok: false, text: t('settings.weight.invalid') })
      return
    }
    setSaving(true)
    setNotice(undefined)
    void api.saveWeights(recent, assistant).then((ok) => {
      setSaving(false)
      setNotice(ok
        ? { ok: true, text: t('settings.weight.saved') }
        : { ok: false, text: t('settings.weight.resetFailed') })
    })
  }

  const onResetWeights = (): void => {
    setSaving(true)
    setNotice(undefined)
    void api.resetWeights().then((ok) => {
      setSaving(false)
      setNotice(ok
        ? { ok: true, text: t('settings.weight.resetDone') }
        : { ok: false, text: t('settings.weight.resetFailed') })
    })
  }

  /** One radio row, shared by the model-source and strategy groups. */
  const option = (name: string, checked: boolean, title: string, desc: string, onPick: () => void) => h(
    'label',
    { className: 'dsh-pf-opt' + (checked ? ' is-on' : '') },
    h('input', { type: 'radio', name, checked, onChange: onPick }),
    h('span', { className: 'dsh-pf-opt-text' },
      h('span', { className: 'dsh-pf-opt-title' }, title),
      h('span', { className: 'dsh-pf-opt-desc' }, desc)),
  )

  const row = (label: string, control: unknown) => h(
    'div',
    { className: 'dsh-pf-row' },
    h('span', { className: 'dsh-pf-row-label' }, label),
    h('div', { className: 'dsh-pf-row-control' }, control),
  )

  /** One editable weight row: label on the left, multiplier control on the right. */
  const weightRow = (label: string, value: string, onChange: (next: string) => void) => h('div', { className: 'dsh-pf-wrow' },
    h('span', { className: 'dsh-pf-wrow-label' }, label),
    h('span', { className: 'dsh-pf-wrow-control' },
      h('span', { className: 'dsh-pf-wrow-times' }, '×'),
      h('input', {
        className: 'dsh-pf-wnum',
        type: 'number',
        min: 1,
        max: 3,
        step: 0.1,
        value,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value),
        onBlur: () => commitWeights(),
      })))

  const textField = (key: 'provider' | 'model') => h('input', {
    className: 'dsh-pf-input',
    value: key === 'provider' ? provider : model,
    placeholder: key === 'provider' ? 'provider（如 zhipu）' : 'model（如 glm-5.3-flash）',
    onChange: (event: { target: { value: string } }) => {
      if (key === 'provider') setProvider(event.target.value)
      else setModel(event.target.value)
    },
  })

  const providerControl = h(Dropdown, {
    value: provider,
    options: catalog.map((group) => ({ id: group.id, name: group.name })),
    placeholder: t('settings.provider.placeholder'),
    onChange: (next: string) => {
      setProvider(next)
      setModel('')
    },
  })

  // Disabled until a provider is chosen: a model list that opens empty reads as
  // a broken control rather than as a missing prerequisite.
  const modelControl = h(Dropdown, {
    value: model,
    options: modelsOf.map((entry) => ({ id: entry.id, name: entry.name })),
    placeholder: provider === '' ? t('settings.needProvider') : t('settings.model.placeholder'),
    disabled: provider === '',
    onChange: setModel,
  })

  return h('div', { className: 'dsh-pf-set' },
    h('div', { className: 'dsh-pf-set-head' },
      h('div', { className: 'dsh-pf-title-row' },
        h('h2', { className: 'dsh-pf-set-h2' }, t('settings.title')),
        h('span', { className: 'dsh-pf-badge' + (dirty ? ' is-dirty' : '') },
          dirty ? t('settings.unsavedBadge') : effective)),
      h('p', { className: 'dsh-pf-set-sub' }, t('settings.sub'))),

    h('section', { className: 'dsh-pf-group' },
      h('div', { className: 'dsh-pf-group-head' },
        h('h3', { className: 'dsh-pf-group-title' }, t('settings.group.model')),
        catalog.length > 0 && h('button', {
          type: 'button',
          className: 'dsh-pf-link',
          onClick: () => setManual(!manual),
        }, manual ? t('settings.useCatalog') : t('settings.useManual'))),
      h('div', { className: 'dsh-pf-opts' },
        option('dsh-pf-model-mode', mode === 'follow', t('settings.mode.follow'), t('settings.mode.follow.desc'), () => {
          setMode('follow')
          setNotice(undefined)
        }),
        option('dsh-pf-model-mode', mode === 'fixed', t('settings.mode.fixed'), t('settings.mode.fixed.desc'), () => {
          setMode('fixed')
          setNotice(undefined)
        })),
      mode === 'fixed' && h('div', { className: 'dsh-pf-form' },
        useSelects
          ? [
              row(t('settings.provider'), providerControl),
              row(t('settings.model'), modelControl),
            ]
          : [
              row(t('settings.provider'), textField('provider')),
              row(t('settings.model'), textField('model')),
            ],
        catalog.length === 0 && h('p', { className: 'dsh-pf-hint' }, t('settings.catalog.empty')))),


    h('div', { className: 'dsh-pf-set-foot' },
      h('span', {
        className: 'dsh-pf-set-notice'
          + (notice !== undefined ? (notice.ok ? ' is-ok' : ' is-bad') : stored.writable === false ? ' is-bad' : ''),
      }, notice !== undefined
        ? notice.text
        // A disabled Save with no explanation reads as a broken button; the
        // only reason it is disabled without a pending edit is a read-only doc.
        : stored.writable === false
          ? t('settings.readonly')
          : dirty ? t('settings.unsaved') : ''),
      h('div', { className: 'dsh-pf-foot-actions' },
        h('button', {
          type: 'button',
          className: 'dsh-pf-btn-action plain',
          disabled: saving || stored.provider === '',
          onClick: onReset,
        }, t('settings.reset')),
        h('button', {
          type: 'button',
          className: 'dsh-pf-btn-action primary',
          disabled: saving || pairMissing || stored.writable === false,
          onClick: onSave,
        }, saving ? t('settings.saving') : t('settings.save')))))
}
