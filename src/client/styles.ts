/**
 * Self-contained stylesheet, injected once as a <style> element: the plugin
 * ships no CSS build step, and class names are prefixed to stay collision
 * free inside the web shell. Colors are declared as panel-scoped variables
 * with a dark default and a light `prefers-color-scheme` override, so the
 * panel follows the OS/shell theme without depending on host theme internals.
 * @module dsh-prompt-forge/client/styles
 */

const STYLE_ID = 'dsh-prompt-forge-styles'

/** The plugin's stylesheet. */
export const CSS = `
/* ---- shared surface: one palette + one shell for every plugin overlay ---- */
.dsh-pf-panel,
.dsh-pf-toast {
  --pe-bg: #1f2127;
  --pe-fg: #e6e8ee;
  --pe-fg-dim: rgba(230, 232, 238, 0.55);
  --pe-border: rgba(127, 127, 127, 0.22);
  --pe-separator: rgba(127, 127, 127, 0.14);
  --pe-hover: rgba(127, 127, 127, 0.14);
  --pe-danger: #f09595;
  --pe-danger-edge: #e2685a;
  --pe-warn-fg: #e8c07d;
  --pe-warn-border: rgba(230, 158, 60, 0.35);
  --pe-warn-bg: rgba(230, 158, 60, 0.12);
  background: var(--pe-bg);
  color: var(--pe-fg);
  border: 1px solid var(--pe-border);
  border-radius: 12px;
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.42);
  outline: none;
}
@media (prefers-color-scheme: light) {
  .dsh-pf-panel,
  .dsh-pf-toast {
    --pe-bg: #ffffff;
    --pe-fg: #1c1e24;
    --pe-fg-dim: rgba(28, 30, 36, 0.55);
    --pe-border: rgba(0, 0, 0, 0.14);
    --pe-separator: rgba(0, 0, 0, 0.1);
    --pe-hover: rgba(0, 0, 0, 0.06);
    --pe-danger: #a63a2e;
    --pe-danger-edge: #c9564a;
    --pe-warn-fg: #8a5a00;
    --pe-warn-border: rgba(176, 122, 0, 0.4);
    --pe-warn-bg: rgba(230, 158, 60, 0.15);
    box-shadow: 0 16px 44px rgba(0, 0, 0, 0.16);
  }
}

/* Comparison dialog: modal, because it asks to overwrite the composer. */
.dsh-pf-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--dsh-pf-z-index, 1000);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
  padding: 24px 16px;
}
.dsh-pf-panel {
  display: flex;
  flex-direction: column;
  width: min(880px, 100%);
  max-height: min(70vh, 640px);
  overflow: hidden;
}

/* Failure notice: a floating card above the composer, no dim, no focus trap. */
.dsh-pf-toast-layer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 120px;
  z-index: 2147483000;
  display: flex;
  justify-content: center;
  padding: 0 16px;
  pointer-events: none;
}
.dsh-pf-toast {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  width: min(520px, 100%);
  border-left: 3px solid var(--pe-danger-edge);
  overflow: hidden;
  animation: dsh-pf-rise 0.16s ease-out;
}
/* The one-line variant: same shell, no card body, no buttons. */
.dsh-pf-notice {
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.5;
  cursor: default;
}
@keyframes dsh-pf-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

/* ---- card head: icon badge + title + meta + close, no heavy title bar ---- */
.dsh-pf-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px 4px 14px;
}
.dsh-pf-card-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  font-size: 11px;
  line-height: 1;
  background: rgba(63, 118, 225, 0.16);
  color: #8fb6ff;
}
.dsh-pf-card-icon.is-error { background: rgba(226, 104, 90, 0.18); color: var(--pe-danger-edge); }
.dsh-pf-card-title { font-size: 13px; font-weight: 500; }
.dsh-pf-card-head .dsh-pf-meta { margin-left: auto; font-size: 11px; opacity: 0.55; }
.dsh-pf-card-head .dsh-pf-meta + .dsh-pf-close { margin-left: 0; }
.dsh-pf-close {
  flex: none;
  margin-left: auto;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  opacity: 0.55;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.dsh-pf-close:hover { opacity: 1; background: var(--pe-hover); }

/* ---- comparison body ---- */
.dsh-pf-body { display: flex; flex: 1; min-height: 0; padding-top: 6px; }
.dsh-pf-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.dsh-pf-col + .dsh-pf-col { border-left: 1px solid var(--pe-separator); }
.dsh-pf-col-title {
  padding: 6px 14px 4px;
  font-size: 11px;
  letter-spacing: 0.04em;
  opacity: 0.55;
}
.dsh-pf-col-text {
  flex: 1;
  margin: 0;
  padding: 0 14px 12px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
}

/* ---- error body: message line + monospace detail chip ---- */
.dsh-pf-error {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 14px 12px;
  font-size: 13px;
  line-height: 1.6;
}
.dsh-pf-error-msg { color: var(--pe-danger); }
.dsh-pf-error-detail {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--pe-fg-dim);
  background: rgba(127, 127, 127, 0.1);
  border-radius: 6px;
  padding: 6px 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ---- loading / streaming ---- */
.dsh-pf-loading {
  display: flex; flex-direction: column; gap: 8px;
  align-items: center; justify-content: center;
  flex: 1; padding: 28px 16px; font-size: 13px;
}
.dsh-pf-loading .dsh-pf-hint { font-size: 11px; opacity: 0.55; }
.dsh-pf-stream {
  display: flex; flex-direction: column;
  flex: 1; min-height: 0; width: 100%;
}
.dsh-pf-stream .dsh-pf-col-title {
  display: flex; align-items: center; gap: 6px;
  padding-left: 0;
}
.dsh-pf-spin.small { width: 11px; height: 11px; border-width: 1px; }
.dsh-pf-spin {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--pe-separator); border-top-color: #6ea8ff;
  animation: dsh-pf-spin 0.9s linear infinite;
}

/* ---- footer + buttons: identical in the panel, the toast and the settings page ---- */
.dsh-pf-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 11px 14px;
  border-top: 1px solid var(--pe-separator);
}
.dsh-pf-toast .dsh-pf-foot { border-top: none; padding-top: 0; }
.dsh-pf-foot .dsh-pf-grow { flex: 1; }
.dsh-pf-btn-action {
  height: 26px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.dsh-pf-btn-action.primary { background: #3f76e1; color: #fff; }
.dsh-pf-btn-action.primary:hover { background: #4d82ec; }
.dsh-pf-btn-action.plain { border-color: rgba(127, 127, 127, 0.28); }
.dsh-pf-btn-action.plain:hover { background: rgba(127, 127, 127, 0.14); }
.dsh-pf-btn-action:disabled { opacity: 0.45; cursor: default; }
.dsh-pf-btn-action:disabled:hover { background: transparent; }
.dsh-pf-btn-action.primary:disabled:hover { background: #3f76e1; }

.dsh-pf-stale {
  padding: 8px 14px;
  font-size: 12px;
  line-height: 1.5;
  border-top: 1px solid var(--pe-warn-border);
  background: var(--pe-warn-bg);
  color: var(--pe-warn-fg);
}

.dsh-pf-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
}
.dsh-pf-btn:hover:not(:disabled) { opacity: 1; background: var(--pe-hover); }
.dsh-pf-btn:disabled { opacity: 0.45; cursor: default; }
.dsh-pf-btn .dsh-pf-btn-icon { font-size: 14px; display: inline-flex; align-items: center; justify-content: center; }
.dsh-pf-spinner {
  display: block;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: dsh-pf-spin 0.7s linear infinite;
  flex: none;
}
.dsh-pf-btn.is-revert { opacity: 0.95; }
.dsh-pf-btn.is-revert .dsh-pf-btn-icon { color: #7ed491; }
@keyframes dsh-pf-spin { to { transform: rotate(360deg); } }

.dsh-pf-undo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 4px;
  font-size: 12px;
  color: inherit;
  opacity: 0.85;
}
.dsh-pf-undo .dsh-pf-undo-check { color: #7ed491; }
.dsh-pf-undo-link {
  border: none; background: var(--pe-hover); color: inherit;
  border-radius: 5px; padding: 3px 10px; font-size: 12px; cursor: pointer;
}
.dsh-pf-undo-link:hover { background: rgba(127,127,127,0.3); }
.dsh-pf-undo-x {
  border: none; background: transparent; color: inherit; opacity: 0.55;
  cursor: pointer; padding: 0 4px; font-size: 12px;
}
.dsh-pf-undo-x:hover { opacity: 1; }

/* settings section (slot settings.section) */
.dsh-pf-set { display: flex; flex-direction: column; gap: 12px; padding: 20px 24px 0; max-width: 720px; }
.dsh-pf-set-head { display: flex; flex-direction: column; gap: 4px; padding-bottom: 16px; }
.dsh-pf-title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsh-pf-set-h2 { font-size: 15px; font-weight: 500; margin: 0; }
.dsh-pf-set-sub { font-size: 12px; opacity: 0.66; margin: 0; line-height: 1.6; }
.dsh-pf-badge {
  flex: none; font-size: 11px; line-height: 1; padding: 5px 9px;
  border-radius: 999px; border: 1px solid rgba(127,127,127,0.3);
  opacity: 0.85; white-space: nowrap; max-width: 280px;
  overflow: hidden; text-overflow: ellipsis;
}
.dsh-pf-badge.is-dirty { border-color: rgba(239,159,39,0.6); color: #ef9f27; opacity: 1; }

.dsh-pf-group {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px;
  border: 1px solid rgba(127,127,127,0.14);
  border-radius: 10px;
  background: rgba(127,127,127,0.045);
}
.dsh-pf-group-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dsh-pf-group-title { font-size: 13px; font-weight: 500; margin: 0; opacity: 0.92; }
.dsh-pf-link { border: none; background: transparent; color: #6fa1ff; font-size: 12px; cursor: pointer; padding: 0; }
.dsh-pf-link:hover { text-decoration: underline; }

.dsh-pf-opts { display: flex; gap: 8px; }
.dsh-pf-opt {
  display: flex; align-items: flex-start; gap: 9px;
  flex: 1 1 0; min-width: 0;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent;
}
.dsh-pf-opt:hover { background: rgba(127,127,127,0.07); }
.dsh-pf-opt.is-on { border-color: rgba(63,118,225,0.55); background: rgba(63,118,225,0.08); }
.dsh-pf-opt input { margin: 2px 0 0; accent-color: #3f76e1; flex: none; }
.dsh-pf-opt-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsh-pf-opt-title { font-size: 13px; line-height: 1.4; }
.dsh-pf-opt-desc { font-size: 12px; opacity: 0.62; line-height: 1.5; }

.dsh-pf-form { display: flex; flex-wrap: wrap; gap: 12px; padding: 4px 0 0; }
.dsh-pf-row { display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px; min-width: 0; }
.dsh-pf-row-label { font-size: 12px; opacity: 0.66; }
.dsh-pf-row-control { min-width: 0; }
.dsh-pf-input {
  height: 30px; width: 100%; box-sizing: border-box;
  border-radius: 6px; border: 1px solid rgba(127,127,127,0.28);
  background: transparent; color: inherit; font-size: 12px; padding: 0 8px;
}
.dsh-pf-hint { font-size: 12px; opacity: 0.6; margin: 0; }
.dsh-pf-weights { display: flex; flex-direction: column; gap: 5px; }
.dsh-pf-wrow {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  max-width: 320px; font-size: 12px;
}
.dsh-pf-wrow-label { opacity: 0.7; }
.dsh-pf-wrow-control { display: inline-flex; align-items: center; gap: 4px; }
.dsh-pf-wrow-times { font-size: 12px; opacity: 0.5; }
.dsh-pf-wnum {
  width: 62px; height: 26px; box-sizing: border-box;
  border-radius: 6px; border: 1px solid rgba(127,127,127,0.28);
  background: transparent; color: inherit; font-size: 12px; padding: 0 6px;
  font-variant-numeric: tabular-nums;
}
.dsh-pf-wnum:focus { outline: none; border-color: #3f76e1; }
.dsh-pf-ta {
  width: 100%; box-sizing: border-box; min-height: 96px; max-height: 280px;
  border-radius: 6px; border: 1px solid rgba(127,127,127,0.28);
  background: transparent; color: inherit; font-family: inherit;
  font-size: 12px; line-height: 1.6; padding: 8px 10px; resize: vertical;
}
.dsh-pf-ta:focus { outline: none; border-color: #3f76e1; }
.dsh-pf-chars {
  margin: 0; font-size: 11px; opacity: 0.55; text-align: right;
  font-variant-numeric: tabular-nums;
}
.dsh-pf-chars.is-over { color: #ef9f27; opacity: 1; }

.dsh-pf-set-foot {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 0; margin-top: 4px;
  border-top: 1px solid rgba(127,127,127,0.16);
}
.dsh-pf-foot-actions { display: flex; gap: 8px; margin-left: auto; }
.dsh-pf-set-notice { font-size: 12px; opacity: 0.7; min-width: 0; }
.dsh-pf-set-notice.is-ok { color: #7ed491; opacity: 1; }
.dsh-pf-set-notice.is-bad { color: #f09595; opacity: 1; }

/* drawn dropdown (replaces the native select, whose OS popup ignores the palette) */
.dsh-pf-dd { position: relative; min-width: 0; width: 100%; }
.dsh-pf-dd-btn {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; height: 30px; padding: 0 9px 0 10px; box-sizing: border-box;
  border: 1px solid rgba(127,127,127,0.28); border-radius: 6px;
  background: transparent; color: inherit; font-size: 12px; cursor: pointer; text-align: left;
  transition: border-color 0.12s ease;
}
.dsh-pf-dd-btn:hover:not(:disabled) { border-color: rgba(127,127,127,0.5); }
.dsh-pf-dd-btn.is-open { border-color: #3f76e1; }
.dsh-pf-dd-btn:disabled { opacity: 0.45; cursor: default; }
.dsh-pf-dd-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-pf-dd-btn.is-empty .dsh-pf-dd-value { opacity: 0.55; }
.dsh-pf-dd-caret {
  flex: none; width: 0; height: 0;
  border-left: 4px solid transparent; border-right: 4px solid transparent;
  border-top: 5px solid currentColor; opacity: 0.65;
  transition: transform 0.15s ease;
}
.dsh-pf-dd-btn.is-open .dsh-pf-dd-caret { transform: rotate(180deg); }
.dsh-pf-dd-menu {
  position: fixed; z-index: 2147483000; box-sizing: border-box;
  max-height: 240px; overflow-y: auto; padding: 4px;
  display: flex; flex-direction: column; gap: 1px;
  border: 1px solid rgba(127,127,127,0.22); border-radius: 10px;
  background: #1f2127; color: #e6e8ee;
  box-shadow: 0 12px 32px rgba(0,0,0,0.42);
}
.dsh-pf-dd-item {
  display: block; width: 100%; text-align: left;
  padding: 7px 10px; border: none; border-radius: 5px;
  background: transparent; color: inherit; font-size: 12px; line-height: 1.4;
  cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dsh-pf-dd-item:hover { background: rgba(140,140,150,0.22); }
.dsh-pf-dd-item.is-on { background: rgba(63,118,225,0.26); color: #d6e4ff; }
.dsh-pf-dd-empty { padding: 8px 10px; font-size: 12px; opacity: 0.6; }
@media (prefers-color-scheme: light) {
  .dsh-pf-dd-menu { background: #ffffff; color: #1c1c1e; border-color: rgba(0,0,0,0.14); box-shadow: 0 10px 26px rgba(0,0,0,0.14); }
  .dsh-pf-dd-item:hover { background: rgba(0,0,0,0.06); }
  .dsh-pf-dd-item.is-on { background: rgba(63,118,225,0.14); color: #1a3f7a; }
}
`

/**
 * Inject the stylesheet once per document.
 * @returns true when injected, false when it was already present.
 */
export function ensureStyles(): boolean {
  if (document.getElementById(STYLE_ID) !== null) return false
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.appendChild(element)
  return true
}
