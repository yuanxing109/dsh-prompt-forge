window.__ModuleLoader__.load({
	id: "dsh-prompt-forge",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  NS: () => NS,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/EnhanceButton.tsx
var import_react3 = require("react");
var import_react_dom = require("react-dom");

// src/shared/validate.ts
function isInvisibleCodePoint(cp) {
  return cp >= 8203 && cp <= 8205 || cp === 65279 || cp >= 8234 && cp <= 8238 || cp >= 8294 && cp <= 8297;
}
function scanText(text) {
  let count = 0;
  let visibleNonBlank = false;
  for (const ch of text) {
    count++;
    const code = ch.codePointAt(0) ?? 0;
    if (!isInvisibleCodePoint(code) && !/\s/.test(ch)) visibleNonBlank = true;
  }
  return { count, visibleNonBlank };
}
function checkInputText(text, maxChars) {
  const { count, visibleNonBlank } = scanText(text);
  if (!visibleNonBlank) {
    return { ok: false, code: "empty" };
  }
  if (count > maxChars) {
    return { ok: false, code: "too-long", count, max: maxChars };
  }
  return { ok: true };
}

// src/shared/protocol.ts
var ENHANCE_ENDPOINT = "/prompt-forge/enhance";
var ENHANCE_STREAM_ENDPOINT = "/prompt-forge/enhance-stream";
var PROMPT_FORGE_ROW_IDS = [
  "prompt-forge",
  "dsh-prompt-forge",
  "web-ui-prompt-forge"
];

// src/client/enhance-client.ts
var EnhanceClientError = class extends Error {
  constructor(detail) {
    super(detail.message);
    this.detail = detail;
  }
};
function jsonBody(body) {
  return new TextEncoder().encode(JSON.stringify(body));
}
var KNOWN_ERROR_CODES = /* @__PURE__ */ new Set([
  "rejected",
  "rate-limit",
  "concurrency-limit",
  "cooldown",
  "timeout",
  "upstream",
  "unconfigured",
  "internal"
]);
function parseError(value) {
  const record = value;
  if (record !== null && typeof record === "object") {
    const code = typeof record.code === "string" && KNOWN_ERROR_CODES.has(record.code) ? record.code : "internal";
    const message = typeof record.message === "string" && record.message !== "" ? record.message : void 0;
    const params = record.params !== null && typeof record.params === "object" ? record.params : void 0;
    return { code, ...message !== void 0 ? { message } : {}, ...params !== void 0 ? { params } : {} };
  }
  return { code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\u3002" };
}
function parseResult(value) {
  const record = value;
  if (record !== null && typeof record === "object" && typeof record.text === "string" && record.text !== "" && typeof record.provider === "string" && record.provider !== "" && typeof record.model === "string" && record.model !== "" && typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)) {
    return { text: record.text, provider: record.provider, model: record.model, elapsedMs: record.elapsedMs };
  }
  throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u7ED3\u679C\u3002" });
}
async function readEnvelope(response) {
  let parsed;
  try {
    parsed = await response.json();
  } catch {
    throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u4E86\u65E0\u6CD5\u89E3\u6790\u7684\u54CD\u5E94\u3002" });
  }
  const envelope = parsed;
  if (envelope !== null && typeof envelope === "object" && envelope.ok === true) {
    return parseResult(envelope.value);
  }
  if (envelope !== null && typeof envelope === "object" && envelope.error !== void 0) {
    throw new EnhanceClientError(parseError(envelope.error));
  }
  throw new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09\u3002` });
}
async function rejectionOf(response) {
  try {
    const parsed = await response.json();
    if (parsed !== null && typeof parsed === "object" && parsed.error !== void 0) {
      return new EnhanceClientError(parseError(parsed.error));
    }
  } catch {
  }
  return new EnhanceClientError({ code: "internal", message: `\u5BBF\u4E3B\u670D\u52A1\u62D2\u7EDD\u4E86\u8BF7\u6C42\uFF08HTTP ${response.status}\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002` });
}
function takeFrames(buffer) {
  const frames = [];
  let rest = buffer;
  for (let index = rest.indexOf("\n\n"); index !== -1; index = rest.indexOf("\n\n")) {
    const raw = rest.slice(0, index);
    rest = rest.slice(index + 2);
    let event = "message";
    const data = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length > 0) frames.push({ event, data: data.join("\n") });
  }
  return { frames, rest };
}
function parseFrame(frame) {
  if (frame.event !== "delta" && frame.event !== "done" && frame.event !== "error") return void 0;
  let parsed;
  try {
    parsed = JSON.parse(frame.data);
  } catch {
    return void 0;
  }
  const record = parsed;
  if (record === null || typeof record !== "object" || record.type !== frame.event) return void 0;
  return record;
}
async function requestEnhanceStream(body, options) {
  let response;
  try {
    response = await fetch(ENHANCE_STREAM_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: jsonBody(body),
      signal: options.signal
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new EnhanceClientError({ code: "internal", message: "\u5DF2\u53D6\u6D88\u589E\u5F3A\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", message: "\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\u670D\u52A1\uFF0C\u8BF7\u786E\u8BA4 dsh web \u6B63\u5728\u8FD0\u884C\u540E\u91CD\u8BD5\u3002" });
  }
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  if (!response.ok) throw await rejectionOf(response);
  const stream = response.body;
  if (stream === null || stream === void 0 || !contentType.includes("event-stream")) {
    void Promise.resolve().then(() => stream?.cancel()).catch(() => {
    });
    return requestEnhance(body, options.signal);
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = takeFrames(buffer);
      buffer = rest;
      for (const frame of frames) {
        const event = parseFrame(frame);
        if (event === void 0) continue;
        if (event.type === "delta") options.onDelta(event.text);
        else if (event.type === "done") return parseResult(event.value);
        else throw new EnhanceClientError(parseError(event.error));
      }
    }
  } finally {
    void Promise.resolve().then(() => reader.cancel()).catch(() => {
    });
  }
  throw new EnhanceClientError({ code: "internal", message: "\u5BBF\u4E3B\u670D\u52A1\u63D0\u524D\u5173\u95ED\u4E86\u589E\u5F3A\u6D41\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
}
async function requestEnhance(body, signal) {
  let response;
  try {
    response = await fetch(ENHANCE_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: jsonBody(body),
      signal
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new EnhanceClientError({ code: "internal", message: "\u5DF2\u53D6\u6D88\u589E\u5F3A\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002" });
    }
    void error;
    throw new EnhanceClientError({ code: "internal", message: "\u65E0\u6CD5\u8FDE\u63A5\u5BBF\u4E3B\u670D\u52A1\uFF0C\u8BF7\u786E\u8BA4 dsh web \u6B63\u5728\u8FD0\u884C\u540E\u91CD\u8BD5\u3002" });
  }
  return readEnvelope(response);
}

// src/client/ResultPanel.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var retryable = (code) => code === "upstream" || code === "timeout" || code === "internal";
var UPSTREAM_ERROR_KEYS = {
  auth: "error.upstream.auth",
  "invalid-credential": "error.upstream.invalidCredential",
  "rate-limit": "error.upstream.rateLimit",
  quota: "error.upstream.quota",
  empty: "error.upstream.empty",
  "context-window": "error.upstream.contextWindow",
  "tool-call": "error.upstream.toolCall",
  "max-tokens": "error.upstream.maxTokens"
};
function localizedErrorMessage(t, code, params) {
  if (code === "rejected" && typeof params?.count === "number" && typeof params?.max === "number") {
    return t("error.tooLong", { count: params.count, max: params.max });
  }
  if (code === "upstream" && typeof params?.reason === "string") {
    const specific = UPSTREAM_ERROR_KEYS[params.reason];
    if (specific !== void 0) return t(specific);
  }
  switch (code) {
    case "rejected":
      return t("error.rejected");
    case "rate-limit":
      return t("error.rateLimit", params);
    case "concurrency-limit":
      return t("error.concurrencyLimit", params);
    case "cooldown":
      return t("error.cooldown", params);
    case "timeout":
      return t("error.timeout", params);
    case "unconfigured":
      return t("error.unconfigured");
    case "upstream":
      return t("error.upstream");
    default:
      return t("error.internal");
  }
}
function fallbackCopy(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
function ResultPanel(props) {
  const { state, t, onApply, onCancel, onRetry } = props;
  const [copied, setCopied] = import_react.useState("idle");
  const panelRef = import_react.useRef(null);
  const openerRef = import_react.useRef(null);
  const errorMode = state.phase === "error";
  import_react.useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing) return;
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (errorMode) return;
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (panel === null) return;
      const focusables = panel.querySelectorAll('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])');
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === void 0 || last === void 0) return;
      const active = document.activeElement;
      const atRoot = active === panel;
      if (event.shiftKey && (active === first || atRoot)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, errorMode]);
  import_react.useEffect(() => {
    if (errorMode) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener === null || !opener.isConnected) return;
      const active = document.activeElement;
      if (active === null || active === document.body) opener.focus();
    };
  }, [errorMode]);
  const copy = import_react.useCallback(() => {
    if (state.result === void 0) return;
    const text = state.result.text;
    const done = (ok) => setCopied(ok ? "ok" : "failed");
    if (navigator.clipboard !== void 0) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
      return;
    }
    done(fallbackCopy(text));
  }, [state.result]);
  const formatMs = (ms) => ms < 1e3 ? `${ms}ms` : `${(ms / 1e3).toFixed(1)}s`;
  const el = import_react.createElement;
  const head = el("div", { className: "dsh-pf-card-head" },
    el("span", { className: "dsh-pf-card-icon" + (errorMode ? " is-error" : ""), "aria-hidden": true },
      errorMode ? "!" : "\u2728"),
    el("span", { className: "dsh-pf-card-title" }, t("panel.title")),
    !errorMode && state.phase === "result" && state.result !== void 0 && el("span", { className: "dsh-pf-meta" },
      t("panel.model", { provider: state.result.provider, model: state.result.model }) + " \xB7 " + t("panel.elapsed", { ms: formatMs(state.result.elapsedMs) })),
    el("button", { type: "button", className: "dsh-pf-close", "aria-label": t("panel.close"), onClick: onCancel }, "\u2715")
  );
  const loadingBody = state.phase === "loading" && el("div", { className: "dsh-pf-loading" },
    state.streaming === void 0 || state.streaming === "" ? [
      el("div", { key: "spin", className: "dsh-pf-spin", "aria-hidden": true }),
      el("div", { key: "msg" }, t("panel.loading")),
      el("div", { key: "hint", className: "dsh-pf-hint" }, t("panel.loading.hint"))
    ] : el("div", { className: "dsh-pf-stream" },
      el("div", { className: "dsh-pf-col-title" },
        el("span", { className: "dsh-pf-spin small", "aria-hidden": true }),
        t("panel.streaming")),
      el("pre", { className: "dsh-pf-col-text" }, state.streaming))
  );
  const errorBody = errorMode && state.error !== void 0 && el("div", { className: "dsh-pf-error" },
    el("div", { className: "dsh-pf-error-msg" },
      state.error.localized !== void 0 ? state.error.localized : localizedErrorMessage(t, state.error.code, state.error.params)),
    state.error.localized === void 0 && state.error.message !== void 0 && state.error.message !== "" && el("div", { className: "dsh-pf-error-detail" }, state.error.message)
  );
  const resultBody = state.phase === "result" && state.result !== void 0 && el("div", { className: "dsh-pf-body" },
    el("div", { className: "dsh-pf-col" },
      el("div", { className: "dsh-pf-col-title" }, t("panel.original")),
      el("pre", { className: "dsh-pf-col-text" }, state.original)),
    el("div", { className: "dsh-pf-col" },
      el("div", { className: "dsh-pf-col-title" }, t("panel.enhanced")),
      el("pre", { className: "dsh-pf-col-text" }, state.result.text))
  );
  const staleBar = state.phase === "result" && state.stale && el("div", { className: "dsh-pf-stale" }, "\u26A0 " + t("panel.stale.warn"));
  const foot = el("footer", { className: "dsh-pf-foot" },
    el("span", { className: "dsh-pf-grow" }),
    errorMode && retryable(state.error?.code) && onRetry !== void 0 && el("button", {
      type: "button", className: "dsh-pf-btn-action primary", onClick: onRetry
    }, t("panel.retry")),
    state.phase === "result" && el("button", { type: "button", className: "dsh-pf-btn-action plain", onClick: copy },
      copied === "ok" ? t("panel.copied") : copied === "failed" ? t("panel.copyFailed") : t("panel.copy")),
    state.phase === "result" && el("button", { type: "button", className: "dsh-pf-btn-action primary", onClick: onApply }, t("panel.apply")),
    state.phase !== "result" && el("button", { type: "button", className: "dsh-pf-btn-action plain", onClick: onCancel },
      state.phase === "loading" ? t("panel.cancel") : t("panel.close"))
  );
  const card = el("section", {
    ref: panelRef,
    className: errorMode ? "dsh-pf-toast" : "dsh-pf-panel",
    role: "dialog",
    "aria-modal": errorMode ? void 0 : "true",
    "aria-label": t("panel.title"),
    tabIndex: -1
  }, head, loadingBody, errorBody, resultBody, staleBar, foot);
  if (errorMode) return el("div", { className: "dsh-pf-toast-layer" }, card);
  return el("div", {
    className: "dsh-pf-overlay",
    onMouseDown: (event) => {
      if (event.target === event.currentTarget) onCancel();
    }
  }, card);
}

// src/client/undo-stack.ts
function totalOf(stacks) {
  let n = 0;
  for (const stack of stacks.values()) n += stack.length;
  return n;
}
function createUndoStack(maxDepth = 3, maxTotalEntries = 60) {
  const stacks = /* @__PURE__ */ new Map();
  return {
    push(sessionId, entry) {
      const stack = stacks.get(sessionId) ?? [];
      stack.push(entry);
      while (stack.length > maxDepth) stack.shift();
      stacks.delete(sessionId);
      stacks.set(sessionId, stack);
      while (totalOf(stacks) > maxTotalEntries) {
        const oldest = stacks.keys().next().value;
        if (oldest === void 0) break;
        stacks.delete(oldest);
      }
    },
    peek(sessionId) {
      const stack = stacks.get(sessionId);
      return stack === void 0 || stack.length === 0 ? void 0 : stack[stack.length - 1];
    },
    pop(sessionId) {
      const stack = stacks.get(sessionId);
      const entry = stack?.pop();
      if (stack !== void 0 && stack.length === 0) stacks.delete(sessionId);
      return entry;
    },
    clear(sessionId) {
      stacks.delete(sessionId);
    },
    depth(sessionId) {
      return stacks.get(sessionId)?.length ?? 0;
    }
  };
}

// src/client/ui-state.ts
var listeners = /* @__PURE__ */ new Set();
var panelState;
var version = 0;
function notify() {
  version++;
  for (const listener of listeners) listener();
}
var pendingDeltaText = "";
var pendingDeltaSession;
var pendingDeltaScheduled = false;
function flushPendingDelta() {
  pendingDeltaScheduled = false;
  if (pendingDeltaText === "" || pendingDeltaSession === void 0) return;
  const sessionId = pendingDeltaSession;
  const text = pendingDeltaText;
  pendingDeltaText = "";
  pendingDeltaSession = void 0;
  if (panelState === void 0 || panelState.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { ...panelState, streaming: (panelState.streaming ?? "") + text };
  notify();
}
function scheduleDeltaFlush() {
  if (pendingDeltaScheduled) return;
  pendingDeltaScheduled = true;
  queueMicrotask(flushPendingDelta);
}
var undoStore = createUndoStack(3);
function pushUndo(sessionId, entry) {
  undoStore.push(sessionId, entry);
  notify();
}
function peekUndo(sessionId) {
  return undoStore.peek(sessionId);
}
function popUndo(sessionId) {
  const entry = undoStore.pop(sessionId);
  notify();
  return entry;
}
var sessions = /* @__PURE__ */ new Map();
var lastMountedSession;
function subscribe(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getVersion() {
  return version;
}
function getPanel() {
  return panelState;
}
function abortOf(state) {
  try {
    state?.abort?.();
  } catch {
  }
}
function openLoading(state) {
  abortOf(panelState);
  panelState = { ...state, phase: "loading" };
  notify();
}
function settleResult(sessionId, result) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { sessionId, phase: "result", original: panelState.original, result };
  notify();
}
function settleError(sessionId, error) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "loading") return;
  panelState = { sessionId, phase: "error", original: panelState.original, error };
  notify();
}
function appendDelta(sessionId, text) {
  if (text === "") return;
  if (panelState === void 0 || panelState.sessionId !== sessionId || panelState.phase !== "loading") return;
  pendingDeltaText += text;
  pendingDeltaSession = sessionId;
  scheduleDeltaFlush();
}
function openError(sessionId, original, error) {
  abortOf(panelState);
  panelState = { sessionId, phase: "error", original, error };
  notify();
}
function setStale(sessionId, stale) {
  if (panelState?.sessionId !== sessionId || panelState.phase !== "result" || panelState.stale === stale) return;
  panelState = { ...panelState, stale };
  notify();
}
function closePanel() {
  abortOf(panelState);
  if (panelState === void 0) return;
  panelState = void 0;
  notify();
}
function registerSession(sessionId, entry) {
  sessions.set(sessionId, entry);
  lastMountedSession = sessionId;
  notify();
  return () => {
    if (sessions.get(sessionId) === entry) sessions.delete(sessionId);
    if (lastMountedSession === sessionId) {
      const keys = [...sessions.keys()];
      lastMountedSession = keys[keys.length - 1];
    }
    if (panelState?.sessionId === sessionId) closePanel();
    undoStore.clear(sessionId);
    notify();
  };
}
function shortcutTarget() {
  const active = document.activeElement;
  if (active !== null && active instanceof Element) {
    let node = active;
    for (let depth = 0; depth < 8 && node !== null; depth++) {
      if (node === document.body || node === document.documentElement) break;
      for (const entry of sessions.values()) {
        if (entry.root !== null && (node === entry.root || node.contains(entry.root))) {
          const found = entry;
          return () => found.run();
        }
      }
      node = node.parentElement;
    }
  }
  const fallback = lastMountedSession !== void 0 ? sessions.get(lastMountedSession) : void 0;
  return fallback === void 0 ? void 0 : () => fallback.run();
}

// src/client/settings.ts
var DEFAULT_CLIENT_SETTINGS = {
  enabled: true,
  maxInputChars: 12e3,
  shortcut: "ctrl+alt+e",
  streaming: true
};
var listeners2 = /* @__PURE__ */ new Set();
var current = DEFAULT_CLIENT_SETTINGS;
function setClientSettings(next) {
  current = next;
  for (const listener of listeners2) listener();
}
function getClientSettings() {
  return current;
}
function subscribeClientSettings(listener) {
  listeners2.add(listener);
  return () => {
    listeners2.delete(listener);
  };
}
function decodeClientSettings(section) {
  const record = section;
  if (record === null || typeof record !== "object") return DEFAULT_CLIENT_SETTINGS;
  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_CLIENT_SETTINGS.enabled,
    maxInputChars: typeof record.maxInputChars === "number" && Number.isFinite(record.maxInputChars) && record.maxInputChars > 0 ? Math.floor(record.maxInputChars) : DEFAULT_CLIENT_SETTINGS.maxInputChars,
    shortcut: typeof record.shortcut === "string" ? record.shortcut : DEFAULT_CLIENT_SETTINGS.shortcut,
    streaming: typeof record.streaming === "boolean" ? record.streaming : DEFAULT_CLIENT_SETTINGS.streaming
  };
}

// src/client/session-key.ts
var import_react2 = require("react");
var fallbackSeq = 0;
var zoneKeys = /* @__PURE__ */ new WeakMap();
function fallbackKeyOf(share) {
  if (share === void 0) return `pe:mount:${++fallbackSeq}`;
  const known = zoneKeys.get(share);
  if (known !== void 0) return known;
  const minted = `pe:zone:${++fallbackSeq}`;
  zoneKeys.set(share, minted);
  return minted;
}
function useSessionKey(maybeSessionId, share) {
  const fallback = (0, import_react2.useRef)(void 0);
  if (maybeSessionId !== void 0 && maybeSessionId !== "") return maybeSessionId;
  if (fallback.current === void 0) fallback.current = fallbackKeyOf(share);
  return fallback.current;
}
function serverSessionId(maybeSessionId) {
  return maybeSessionId !== void 0 && maybeSessionId !== "" ? maybeSessionId : void 0;
}

// src/client/EnhanceButton.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var EMPTY_REFERENCES = [];
function countOf(value) {
  return Array.isArray(value) ? value.length : 0;
}
function stringOf(value) {
  return typeof value === "string" ? value : "";
}
function pfIsRecord(value) {
  return typeof value === "object" && value !== null;
}
function pfAllIndexes(haystack, needle) {
  const found = [];
  if (needle === "") return found;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    found.push(at);
    from = at + needle.length;
  }
}
function pfCleanReference(value, sourceText) {
  if (!pfIsRecord(value)) return void 0;
  const source = typeof value.source === "string" ? value.source : "";
  const ref = typeof value.ref === "string" ? value.ref : "";
  if (source === "" && ref === "") return void 0;
  const rawOffset = typeof value.offset === "number" && Number.isInteger(value.offset) ? value.offset : -1;
  const rawLength = typeof value.length === "number" && Number.isInteger(value.length) ? value.length : -1;
  let clipboardText = typeof value.clipboardText === "string" ? value.clipboardText : "";
  if (clipboardText === "" && sourceText !== void 0 && rawOffset >= 0 && rawLength > 0) {
    clipboardText = sourceText.slice(rawOffset, rawOffset + rawLength);
  }
  if (clipboardText === "") return void 0;
  const record = {
    source,
    ref,
    offset: rawOffset >= 0 ? rawOffset : 0,
    length: clipboardText.length,
    label: typeof value.label === "string" && value.label !== "" ? value.label : clipboardText,
    clipboardText
  };
  const appearance = value.appearance;
  if (appearance === "session" || appearance === "file" || appearance === "folder") {
    record.appearance = appearance;
  }
  return record;
}
function pfCleanReferences(values, sourceText) {
  const records = [];
  for (const value of values) {
    const record = pfCleanReference(value, sourceText);
    if (record !== void 0) records.push(record);
  }
  return records;
}
function pfValidateDraft(text, references) {
  const ordered = [...references].sort((left, right) => left.offset - right.offset);
  let previousEnd = 0;
  for (const record of ordered) {
    if (record.length <= 0 || record.length !== record.clipboardText.length) return void 0;
    if (record.offset < previousEnd) return void 0;
    const end = record.offset + record.length;
    if (end > text.length) return void 0;
    if (text.slice(record.offset, end) !== record.clipboardText) return void 0;
    previousEnd = end;
  }
  if (text.startsWith("/")) {
    const token = /^\/\S+\s/.exec(text);
    if (token !== null) {
      const tokenEnd = token[0].length;
      for (const record of ordered) if (record.offset < tokenEnd) return void 0;
    }
  }
  return { text, references: ordered };
}
function pfPlanAnchoredDraft(nextText, references, sourceText) {
  const records = pfCleanReferences(references, sourceText);
  if (records.length === 0) return { text: nextText, references: [] };
  const wanted = /* @__PURE__ */ new Map();
  for (const record of records) {
    wanted.set(record.clipboardText, (wanted.get(record.clipboardText) ?? 0) + 1);
  }
  let text = nextText;
  for (const [token, keep] of wanted) {
    const found = pfAllIndexes(text, token);
    for (let index = found.length - 1; index >= keep; index -= 1) {
      text = text.slice(0, found[index]) + text.slice(found[index] + token.length);
    }
  }
  const slots = /* @__PURE__ */ new Map();
  for (const token of wanted.keys()) slots.set(token, pfAllIndexes(text, token));
  const taken = /* @__PURE__ */ new Map();
  const placed = [];
  let out = text;
  for (const record of records) {
    const candidates = slots.get(record.clipboardText) ?? [];
    const index = taken.get(record.clipboardText) ?? 0;
    if (index < candidates.length) {
      taken.set(record.clipboardText, index + 1);
      placed.push({ ...record, offset: candidates[index], length: record.clipboardText.length });
      continue;
    }
    const separator = out === "" || /\s$/.test(out) ? "" : " ";
    const offset = out.length + separator.length;
    out += separator + record.clipboardText;
    placed.push({ ...record, offset, length: record.clipboardText.length });
  }
  return pfValidateDraft(out, placed);
}
function pfPlanRestoredDraft(text, references, sourceText) {
  const records = pfCleanReferences(references, sourceText ?? text);
  if (records.length === 0) return { text, references: [] };
  return pfValidateDraft(text, records);
}
function EnhanceButton(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const wireId = serverSessionId(sessionId);
  const draft = useInput((state) => stringOf(state.draft));
  const phase = useInput((state) => state.phase);
  const occurrences = useInput((state) => {
    const raw = state.occurrences;
    return Array.isArray(raw) ? raw : EMPTY_REFERENCES;
  });
  const occurrenceCount = occurrences.length;
  const attachmentCount = useInput((state) => {
    const record = state;
    return countOf(record.attachmentIds) + countOf(record.imageIds);
  });
  const settings = (0, import_react3.useSyncExternalStore)(subscribeClientSettings, getClientSettings);
  const panel = (0, import_react3.useSyncExternalStore)(subscribe, getPanel);
  const getUndo = (0, import_react3.useCallback)(() => peekUndo(uiKey), [uiKey]);
  const undoEntry = (0, import_react3.useSyncExternalStore)(subscribe, getUndo);
  const [notice, setNotice] = (0, import_react3.useState)(null);
  const rootRef = (0, import_react3.useRef)(null);
  const busy = panel !== void 0 && panel.sessionId === uiKey && panel.phase === "loading";
  const canRevert = undoEntry !== void 0 && draft === undoEntry.applied && draft !== "";
  const anyBusy = panel !== void 0 && panel.phase === "loading";
  const otherBusy = anyBusy && !busy;
  const start = (0, import_react3.useCallback)(() => {
    if (anyBusy) return;
    if (!settings.enabled) {
      const disabled = t("error.disabled");
      openError(uiKey, draft, { code: "rejected", localized: disabled });
      return;
    }
    if (draft.trim() === "") {
      if (attachmentCount > 0 || occurrenceCount > 0) {
        const attachmentsOnly = t("error.attachmentsOnly");
        openError(uiKey, draft, { code: "rejected", localized: attachmentsOnly });
      }
      return;
    }
    const check = checkInputText(draft, settings.maxInputChars);
    if (!check.ok) {
      const message = check.code === "empty" ? t("error.empty") : t("error.tooLong", { count: check.count, max: check.max });
      openError(uiKey, draft, { code: "rejected", localized: message });
      return;
    }
    if (phase !== "plain") {
      const busyPhase = t("error.phase");
      openError(uiKey, draft, { code: "rejected", localized: busyPhase });
      return;
    }
    const controller = new AbortController();
    openLoading({ sessionId: uiKey, original: draft, abort: () => controller.abort() });
    const settle = (result) => settleResult(uiKey, result);
    const fail = (error) => {
      const detail = error instanceof EnhanceClientError ? error.detail : { code: "internal", message: error instanceof Error ? error.message : String(error) };
      settleError(uiKey, detail);
    };
    if (settings.streaming) {
      requestEnhanceStream({ sessionId: wireId, text: draft }, {
        signal: controller.signal,
        onDelta: (delta) => appendDelta(uiKey, delta)
      }).then(settle, fail);
      return;
    }
    requestEnhance({ sessionId: wireId, text: draft }, controller.signal).then(settle, fail);
  }, [anyBusy, draft, attachmentCount, occurrenceCount, phase, settings, uiKey, wireId, t]);
  const runRef = (0, import_react3.useRef)(start);
  (0, import_react3.useEffect)(() => {
    runRef.current = start;
  });
  (0, import_react3.useEffect)(() => {
    const entry = {
      root: rootRef.current,
      run: () => runRef.current()
    };
    return registerSession(uiKey, entry);
  }, [uiKey]);
  (0, import_react3.useEffect)(() => {
    if (panel !== void 0 && panel.sessionId === uiKey && panel.phase === "result") {
      setStale(uiKey, draft !== panel.original);
    }
  }, [draft, panel, uiKey]);
  const writeDraft = (0, import_react3.useCallback)((text, references, keepOffsets = false, sourceText) => {
    const setDraft = inputActions.setDraft;
    if (references === void 0 || references.length === 0) {
      setDraft(text);
      return;
    }
    const planned = keepOffsets ? pfPlanRestoredDraft(text, references, sourceText ?? text) : pfPlanAnchoredDraft(text, references, sourceText);
    if (planned === void 0) {
      setDraft(text);
      setNotice(t("notice.referencesDropped"));
      return;
    }
    if (planned.references.length === 0) {
      setDraft(planned.text);
      return;
    }
    setDraft(planned);
  }, [inputActions, t]);
  (0, import_react3.useEffect)(() => {
    if (panel === void 0 || panel.sessionId !== uiKey) return;
    if (panel.phase !== "result" || panel.result === void 0) return;
    const enhanced = panel.result.text;
    if (draft !== panel.original) {
      setNotice(t("notice.staleDraft"));
      closePanel();
      return;
    }
    if (enhanced === "") {
      setNotice(t("notice.emptyResult"));
      closePanel();
      return;
    }
    pushUndo(uiKey, { original: draft, applied: enhanced, originalReferences: occurrences });
    writeDraft(enhanced, occurrences, false, panel.original);
    closePanel();
  }, [draft, occurrences, panel, uiKey, t, writeDraft]);
  const onClick = (0, import_react3.useCallback)(() => {
    if (busy) {
      closePanel();
      return;
    }
    if (canRevert && undoEntry !== void 0) {
      writeDraft(undoEntry.original, undoEntry.originalReferences, true);
      popUndo(uiKey);
      closePanel();
      return;
    }
    start();
  }, [busy, canRevert, undoEntry, uiKey, start, writeDraft]);
  (0, import_react3.useEffect)(() => {
    if (panel === void 0 || panel.sessionId !== uiKey || panel.phase !== "error" || panel.error === void 0) return;
    setNotice(panel.error.localized !== void 0 ? panel.error.localized : localizedErrorMessage(t, panel.error.code, panel.error.params));
    closePanel();
  }, [panel, uiKey, t]);
  (0, import_react3.useEffect)(() => {
    if (notice === null) return;
    const timer = setTimeout(() => setNotice(null), 6e3);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!settings.enabled) return null;
  const icon = canRevert ? "↩" : "✨";
  const glyph = busy ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pf-spinner", "aria-hidden": true }) : icon;
  const title = busy ? t("button.cancelBusy") : canRevert ? t("button.revert") : otherBusy ? t("button.otherBusy") : t("button.title");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "button",
      {
        ref: rootRef,
        type: "button",
        className: "dsh-pf-btn" + (busy ? " is-busy" : "") + (canRevert ? " is-revert" : ""),
        "aria-label": title,
        title,
        "aria-disabled": otherBusy || void 0,
        onClick,
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dsh-pf-btn-icon", "aria-hidden": true, children: glyph })
      }
    ),
    notice !== null && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pf-toast-layer", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dsh-pf-toast dsh-pf-notice", role: "status", "aria-live": "polite", children: notice }) }),
      document.body
    ),
  ] });
}

// src/client/UndoBar.tsx
var import_react4 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
function UndoBar(props) {
  const { t, sessionId, useInput, inputActions } = props;
  const uiKey = useSessionKey(sessionId, inputActions);
  const draft = useInput((state) => {
    const value = state.draft;
    return typeof value === "string" ? value : "";
  });
  (0, import_react4.useSyncExternalStore)(subscribe, getVersion);
  const entry = peekUndo(uiKey);
  (0, import_react4.useEffect)(() => {
    if (entry !== void 0 && entry.applied !== draft) popUndo(uiKey);
  }, [draft, entry, uiKey]);
  if (entry === void 0 || entry.applied !== draft) return null;
  const undo = () => {
    inputActions.setDraft(entry.original);
    popUndo(uiKey);
  };
  const dismiss = () => {
    popUndo(uiKey);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-pf-undo", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-pf-undo-check", "aria-hidden": true, children: "\u2713" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: t("undo.applied") }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dsh-pf-undo-link", onClick: undo, children: t("undo.undo") }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "dsh-pf-undo-x", "aria-label": t("undo.dismiss"), onClick: dismiss, children: "\u2715" })
  ] });
}

// src/client/locales.ts
var zh = {
"button.title": "\u91CD\u5199\u4E3A\u7ED3\u6784\u5316\u63D0\u793A\u8BCD",
  "button.cancelBusy": "正在增强，点击可取消（输入框内容不会被改动）",
  "button.revert": "已应用增强结果，点击还原原文",
  "button.busy": "\u6B63\u5728\u589E\u5F3A\u2026",
  "button.otherBusy": "\u53E6\u4E00\u4E2A\u4F1A\u8BDD\u6B63\u5728\u589E\u5F3A\u4E2D\uFF1B\u8BF7\u7B49\u5B83\u5B8C\u6210\u6216\u5148\u5173\u95ED\u5176\u7ED3\u679C\u9762\u677F\u3002",
  "panel.title": "\u63D0\u793A\u8BCD\u589E\u5F3A",
  "panel.loading": "\u6B63\u5728\u589E\u5F3A\uFF0C\u7A0D\u5019\u2026",
  "panel.streaming": "\u6B63\u5728\u751F\u6210\uFF08\u8FB9\u5199\u8FB9\u663E\u793A\uFF09\u2026",
  "panel.loading.hint": "\u539F\u6587\u4FDD\u7559\u5728\u8F93\u5165\u6846\u4E2D\uFF0C\u4E0D\u4F1A\u88AB\u52A8\u4FEE\u6539\u3002",
  "panel.cancel": "\u53D6\u6D88",
  "panel.original": "\u539F\u59CB\u63D0\u793A\u8BCD",
  "panel.enhanced": "\u589E\u5F3A\u7ED3\u679C",
  "panel.apply": "\u56DE\u586B\u5230\u8F93\u5165\u6846",
  "panel.copy": "\u590D\u5236\u7ED3\u679C",
  "panel.copied": "\u5DF2\u590D\u5236",
  "panel.copyFailed": "\u590D\u5236\u5931\u8D25",
  "panel.close": "\u5173\u95ED",
  "panel.retry": "\u91CD\u8BD5",
  "panel.stale.warn": "\u8349\u7A3F\u5728\u589E\u5F3A\u671F\u95F4\u6709\u6539\u52A8\u2014\u2014\u589E\u5F3A\u7ED3\u679C\u57FA\u4E8E\u589E\u5F3A\u524D\u7684\u6587\u672C\u3002\u56DE\u586B\u5C06\u8986\u76D6\u4F60\u7684\u6700\u65B0\u7F16\u8F91(\u64A4\u9500\u53EF\u6062\u590D\u56DE\u586B\u524D\u7684\u8349\u7A3F)\u3002",
  "panel.model": "\u6A21\u578B\uFF1A{provider} / {model}",
  "panel.elapsed": "\u8017\u65F6 {ms}",
  "undo.applied": "\u5DF2\u7528\u589E\u5F3A\u7ED3\u679C\u66FF\u6362\u539F\u63D0\u793A\u8BCD",
  "undo.undo": "\u64A4\u9500",
  "undo.dismiss": "\u5173\u95ED\u63D0\u793A",
  "notice.staleDraft": "\u8349\u7A3F\u5728\u589E\u5F3A\u671F\u95F4\u6709\u6539\u52A8\uFF0C\u5DF2\u653E\u5F03\u672C\u6B21\u7ED3\u679C\uFF08\u539F\u6587\u672A\u6539\u52A8\uFF09\u3002",
  "notice.emptyResult": "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u7ED3\u679C\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "notice.referencesDropped": "\u672C\u6B21\u672A\u80FD\u4FDD\u7559\u6587\u4EF6\u5F15\u7528\uFF0C\u5DF2\u6309\u7EAF\u6587\u672C\u5199\u56DE\u3002",
  "error.empty": "\u8F93\u5165\u6846\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u8F93\u5165\u8981\u589E\u5F3A\u7684\u63D0\u793A\u8BCD\u3002",
  "error.tooLong": "\u5185\u5BB9\u5171 {count} \u4E2A\u5B57\u7B26\uFF0C\u8D85\u8FC7 {max} \u4E2A\u5B57\u7B26\u4E0A\u9650\uFF08\u6309 Unicode \u5B57\u7B26\u6570\u7EDF\u8BA1\uFF0C\u4E0D\u662F token \u6570\uFF09\u3002\u4E3A\u907F\u514D\u6539\u53D8\u539F\u610F\u4E0D\u4F1A\u81EA\u52A8\u622A\u65AD\uFF0C\u8BF7\u7CBE\u7B80\u540E\u518D\u8BD5\u3002",
  "error.attachmentsOnly": "\u8f93\u5165\u6846\u53ea\u9644\u52a0\u4e86\u9644\u4ef6\u6216\u5f15\u7528\uff0c\u8bf7\u8865\u5145\u8981\u589e\u5f3a\u7684\u6587\u672c\u3002",
  "error.occurrences": "\u8F93\u5165\u5185\u5BB9\u5305\u542B\u547D\u4EE4\u6216\u6587\u4EF6\u5F15\u7528\uFF0C\u6682\u4E0D\u652F\u6301\u589E\u5F3A\uFF1B\u8BF7\u5148\u79FB\u9664\u540E\u518D\u8BD5\u3002",
  "error.phase": "\u5F53\u524D\u8F93\u5165\u6B63\u88AB\u5360\u7528\uFF08\u63D0\u4EA4\u4E2D\uFF09\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
  "error.disabled": "\u63D0\u793A\u8BCD\u589E\u5F3A\u5DF2\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5173\u95ED\u3002",
  "error.rejected": "\u589E\u5F3A\u8BF7\u6C42\u88AB\u62D2\u7EDD\u3002",
  "error.timeout": "\u589E\u5F3A\u8D85\u65F6\uFF08{seconds} \u79D2\uFF09\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.unconfigured": "\u5C1A\u672A\u786E\u5B9A\u589E\u5F3A\u7528\u7684\u6A21\u578B\uFF1A\u8BF7\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u6210\u5BF9\u586B\u5199 provider/model\uFF0C\u6216\u5148\u5728\u5F53\u524D\u4F1A\u8BDD\u53D1\u9001\u4E00\u6761\u6D88\u606F\uFF08\u5C06\u8DDF\u968F\u4F1A\u8BDD\u6A21\u578B\uFF09\u3002",
  "error.upstream": "\u6A21\u578B\u670D\u52A1\u8FD4\u56DE\u9519\u8BEF\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.internal": "\u589E\u5F3A\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\uFF1B\u539F\u8F93\u5165\u672A\u6539\u52A8\u3002",
  "error.rateLimit": "\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF1A\u6BCF\u5206\u949F\u6700\u591A {limit} \u6B21\u589E\u5F3A\uFF0C\u8BF7\u5728 {retryAfterSeconds} \u79D2\u540E\u518D\u8BD5\u3002",
  "error.concurrencyLimit": "\u5DF2\u6709 {max} \u4E2A\u589E\u5F3A\u6B63\u5728\u8FDB\u884C\uFF0C\u8BF7\u7B49\u5176\u4E2D\u4E00\u4E2A\u5B8C\u6210\u540E\u518D\u8BD5\u3002",
  "error.cooldown": "\u8FDE\u7EED {failures} \u6B21\u589E\u5F3A\u5931\u8D25\uFF0C\u5DF2\u6682\u505C\u8C03\u7528\u4EE5\u514D\u6301\u7EED\u51B2\u51FB\u6A21\u578B\u670D\u52A1\uFF1B\u8BF7 {retryAfterSeconds} \u79D2\u540E\u91CD\u8BD5\uFF0C\u6216\u5148\u68C0\u67E5\u8BBE\u7F6E\u91CC\u7684\u6A21\u578B\u914D\u7F6E\u3002",
  "error.upstream.auth": "\u9274\u6743\u5931\u8D25\uFF1A\u8BF7\u68C0\u67E5\u8BE5 provider \u7684 API Key \u914D\u7F6E\u3002",
  "error.upstream.invalidCredential": "\u9274\u6743\u5931\u8D25\uFF1A\u5B58\u50A8\u7684 API Key \u4E0D\u53EF\u7528\uFF0C\u8BF7\u4FEE\u6B63\u540E\u91CD\u8BD5\u3002",
  "error.upstream.rateLimit": "\u6A21\u578B\u670D\u52A1\u9650\u6D41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "error.upstream.quota": "\u6A21\u578B\u670D\u52A1\u914D\u989D/\u4F59\u989D\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u8D26\u6237\u3002",
  "error.upstream.empty": "\u6A21\u578B\u8FD4\u56DE\u4E86\u7A7A\u54CD\u5E94\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "error.upstream.contextWindow": "\u8F93\u5165\u8D85\u51FA\u6A21\u578B\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF0C\u8BF7\u7CBE\u7B80\u539F\u6587\u6216\u66F4\u6362\u6A21\u578B\u3002",
  "error.upstream.toolCall": "\u6A21\u578B\u8BF7\u6C42\u4E86\u5DE5\u5177\u8C03\u7528\uFF0C\u63D0\u793A\u8BCD\u589E\u5F3A\u53EA\u9700\u8981\u7EAF\u6587\u672C\uFF1B\u8BF7\u66F4\u6362\u6A21\u578B\u540E\u91CD\u8BD5\u3002",
  "error.upstream.maxTokens": "\u91CD\u5199\u7ED3\u679C\u8FBE\u5230\u8F93\u51FA\u4E0A\u9650\uFF08maxOutputTokens\uFF09\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u8C03\u5927\u4E0A\u9650\u6216\u7CBE\u7B80\u539F\u6587\u540E\u91CD\u8BD5\u3002",
  "settings.nav": "提示词增强",
  "settings.title": "提示词增强",
  "settings.sub": "控制增强用哪个模型来重写你的草稿。",
  "settings.model.heading": "增强使用的模型",
  "settings.mode.follow": "跟随当前会话模型",
  "settings.mode.follow.desc": "你切换会话模型时，增强模型随之变化，行为与之前一致。",
  "settings.mode.fixed": "指定固定模型",
  "settings.mode.fixed.desc": "无论会话用什么模型，增强始终走这里选定的模型。适合用免费或低成本模型做重写。",
  "settings.provider": "提供方",
  "settings.model": "模型",
  "settings.provider.placeholder": "选择提供方",
  "settings.model.placeholder": "选择模型",
  "settings.catalog.empty": "未能读取宿主的模型目录，请手动填写 provider 与 model。",
  "settings.useManual": "改为手动填写",
  "settings.useCatalog": "改为从列表选择",
  "settings.current": "当前生效",
  "settings.priority.title": "与主会话模型的关系",
  "settings.priority.body": "优先级从高到低：① 此处指定的固定模型 → ② 当前会话模型 → ③ 全局默认模型。选「跟随当前会话模型」时留空即可；三者都指不出路由时，增强会报错而不是猜测一个。",
  "settings.cost": "增强是一次独立的模型调用，按你选定模型的规则单独计费，与主对话用量分开计算。保存后对下一次增强立即生效，无需重启。",
  "settings.save": "保存",
  "settings.saving": "保存中…",
  "settings.saved": "已保存，下一次增强立即生效。",
  "settings.saveFailed": "保存失败：宿主拒绝了这次修改（可能没有写权限）。",
  "settings.needPair": "请同时选择提供方与模型，或改回跟随会话模型。",
  "settings.reset": "恢复为跟随会话模型",
  "settings.unsaved": "有未保存的修改",
  "settings.readonly": "当前配置为只读，修改无法保存。",
  "settings.group.model": "模型来源",
  "settings.group.rules": "生效规则",
  "settings.rule.priority": "固定模型优先于会话模型，会话模型优先于全局默认模型。",
  "settings.rule.cost": "增强是一次独立调用，按所选模型单独计费，与主对话用量分开。",
  "settings.rule.apply": "保存后对下一次增强立即生效，无需重启。",
  "settings.needProvider": "先选择提供方",
  "settings.unsavedBadge": "未保存",
  "settings.group.context": "上下文装配",
  "settings.weight.recent": "最近 2 轮",
  "settings.weight.assistant": "assistant 正文",
  "settings.weight.reset": "重置为默认值",
  "settings.weight.resetDone": "已恢复默认权重。",
  "settings.weight.resetFailed": "重置失败：宿主拒绝了这次修改。",
  "settings.weight.hint": "权重 1 表示与更早的轮次/用户轮等权，范围 1–3；改完离开输入框即保存。工具调用、工具结果与 reasoning 始终不参与装配。",
  "settings.weight.invalid": "权重必须是 1–3 之间的数字。",
  "settings.weight.saved": "权重已保存。",
  "settings.group.strategy": "增强策略",
  "settings.strategy.builtin": "使用内置策略",
  "settings.strategy.builtin.desc": "不编造、未知细节插占位符、只输出正文——这些硬规则由内置策略保证。",
  "settings.strategy.custom": "自定义（追加在内置策略之后）",
  "settings.strategy.custom.desc": "只写你的补充要求，内置策略的硬规则继续生效。",
  "settings.strategy.placeholder": "例如：所有输出保持中文；不要出现「步骤」字样；技术术语换成业务语言。",
  "settings.strategy.reset": "恢复内置",
  "settings.strategy.hint": "内置策略约 3400 字，两者合计建议不超过 8000。离开输入框即保存。",
  "settings.strategy.saved": "策略已保存。",
  "settings.strategy.resetDone": "已恢复内置策略。",
  "settings.strategy.resetFailed": "保存失败：宿主拒绝了这次修改。",
};
var en = {
"button.title": "Rewrite into a structured prompt",
  "button.cancelBusy": "Enhancing — click to cancel (your draft is untouched)",
  "button.revert": "Enhanced text applied — click to restore the original",
  "button.busy": "Enhancing\u2026",
  "button.otherBusy": "Another session is enhancing right now \u2014 wait for it, or close its result panel first.",
  "panel.title": "Prompt Enhance",
  "panel.loading": "Enhancing, please wait\u2026",
  "panel.streaming": "Generating (shown as it is written)\u2026",
  "panel.loading.hint": "Your draft stays untouched until you apply the result.",
  "panel.cancel": "Cancel",
  "panel.original": "Original prompt",
  "panel.enhanced": "Enhanced result",
  "panel.apply": "Fill into input box",
  "panel.copy": "Copy result",
  "panel.copied": "Copied",
  "panel.copyFailed": "Copy failed",
  "panel.close": "Close",
  "panel.retry": "Retry",
  "panel.stale.warn": "The draft changed while enhancing \u2014 the result is based on the pre-enhance text. Applying will overwrite your latest edits (undo restores the draft as it was before applying).",
  "panel.model": "Model: {provider} / {model}",
  "panel.elapsed": "{ms} elapsed",
  "undo.applied": "Original prompt replaced by the enhanced version",
  "undo.undo": "Undo",
  "undo.dismiss": "Dismiss",
  "notice.staleDraft": "The draft changed while enhancing, so this result was discarded (your text is untouched).",
  "notice.emptyResult": "The model returned an empty result \u2014 retry.",
  "notice.referencesDropped": "The file references could not be preserved; the draft was written as plain text.",
  "error.empty": "The input box is empty \u2014 type a prompt to enhance first.",
  "error.tooLong": "The draft is {count} characters, above the {max} cap (Unicode characters, not tokens). It is never auto-truncated (that would change your meaning) \u2014 please shorten it.",
  "error.attachmentsOnly": "The composer only has attachments or references; add the text you want enhanced.",
  "error.occurrences": "The draft contains commands or file references, which are not supported yet \u2014 remove them first.",
  "error.phase": "The input box is busy (submitting) \u2014 try again in a moment.",
  "error.disabled": "Prompt enhance is disabled in the plugin settings.",
  "error.rejected": "The enhance request was rejected.",
  "error.timeout": "The enhancement timed out ({seconds}s). Retry; your draft is untouched.",
  "error.unconfigured": "No model resolved for the enhancement: pair provider/model in the plugin settings, or send a message in the current session first (the enhancement will follow the session model).",
  "error.upstream": "The model provider returned an error. Retry; your draft is untouched.",
  "error.internal": "Enhancement failed. Retry; your draft is untouched.",
  "error.rateLimit": "Too many requests \u2014 at most {limit} enhancements per minute; retry in {retryAfterSeconds} seconds.",
  "error.concurrencyLimit": "{max} enhancements are already running \u2014 wait for one to finish, then retry.",
  "error.cooldown": "{failures} enhancements failed in a row; calls are paused to stop hammering the model service. Retry in {retryAfterSeconds}s, or check the model settings first.",
  "error.upstream.auth": "Authentication failed \u2014 check the API key configured for this provider.",
  "error.upstream.invalidCredential": "Authentication failed \u2014 the stored API key is invalid; fix it and retry.",
  "error.upstream.rateLimit": "The model provider is rate-limiting; retry later.",
  "error.upstream.quota": "The model provider reports a quota/balance issue \u2014 check your account.",
  "error.upstream.empty": "The model returned an empty response; retry.",
  "error.upstream.contextWindow": "The input exceeds the model context window \u2014 shorten it or switch models.",
  "error.upstream.toolCall": "The model requested tool calls, but prompt enhance needs plain text \u2014 switch models and retry.",
  "error.upstream.maxTokens": "The rewrite hit the output cap (maxOutputTokens) \u2014 raise it in settings or shorten the draft.",
  "settings.nav": "Prompt Enhance",
  "settings.title": "Prompt Enhance",
  "settings.sub": "Choose which model rewrites your draft.",
  "settings.model.heading": "Model used for enhancement",
  "settings.mode.follow": "Follow the session model",
  "settings.mode.follow.desc": "The enhancement model changes whenever you switch the session model — the original behaviour.",
  "settings.mode.fixed": "Pin a fixed model",
  "settings.mode.fixed.desc": "Enhancement always uses the model picked here, whatever the session uses. Useful for a free or low-cost model doing the rewriting.",
  "settings.provider": "Provider",
  "settings.model": "Model",
  "settings.provider.placeholder": "Select a provider",
  "settings.model.placeholder": "Select a model",
  "settings.catalog.empty": "The host model catalog could not be read — enter the provider and model manually.",
  "settings.useManual": "Enter manually instead",
  "settings.useCatalog": "Pick from the list instead",
  "settings.current": "In effect",
  "settings.priority.title": "How this relates to the session model",
  "settings.priority.body": "Precedence, highest first: 1) the fixed model set here, 2) the current session model, 3) the global default model. Leave it on \"follow the session model\" for the original behaviour; when none of the three resolves a route, the enhancement reports an error instead of guessing.",
  "settings.cost": "Each enhancement is a separate model call, billed under the chosen model and counted apart from the conversation. Saved changes apply to the next enhancement, no restart needed.",
  "settings.save": "Save",
  "settings.saving": "Saving…",
  "settings.saved": "Saved — the next enhancement uses it.",
  "settings.saveFailed": "Save failed: the host rejected the change (possibly read-only).",
  "settings.needPair": "Pick both a provider and a model, or switch back to following the session model.",
  "settings.reset": "Back to following the session model",
  "settings.readonly": "This configuration is read-only; changes cannot be saved.",
  "settings.unsaved": "Unsaved changes",
  "settings.group.model": "Model source",
  "settings.group.rules": "How it applies",
  "settings.rule.priority": "A pinned model outranks the session model, which outranks the global default.",
  "settings.rule.cost": "Each enhancement is a separate call, billed under the chosen model and counted apart from the conversation.",
  "settings.rule.apply": "Saved changes apply to the next enhancement, no restart needed.",
  "settings.needProvider": "Select a provider first",
  "settings.unsavedBadge": "Unsaved",
  "settings.group.context": "Context assembly",
  "settings.weight.recent": "Newest 2 turns",
  "settings.weight.assistant": "Assistant text",
  "settings.weight.reset": "Reset to defaults",
  "settings.weight.hint": "Weight 1 is equal to older turns (and to user turns for the assistant weight); range 1–3. Changes save when the field loses focus. Tool calls, tool results and reasoning never take part in assembly.",
  "settings.weight.resetFailed": "Reset failed: the host rejected the change.",
  "settings.weight.resetDone": "Default weights restored.",
  "settings.weight.hint": "Read-only view of the current values; adjust them on the Plugins config page. Tool calls, tool results and reasoning never take part in assembly.",
  "settings.weight.invalid": "A weight must be a number between 1 and 3.",
  "settings.weight.saved": "Weights saved.",
  "settings.group.strategy": "Enhancement strategy",
  "settings.strategy.builtin": "Use the built-in strategy",
  "settings.strategy.builtin.desc": "No fabrication, explicit placeholders for unknown details, prompt-only output — the built-in strategy is what guarantees these.",
  "settings.strategy.custom": "Custom (appended after the built-in strategy)",
  "settings.strategy.custom.desc": "Write only your additions; the built-in hard rules stay in force.",
  "settings.strategy.placeholder": "e.g. Always answer in Chinese; never use the word \"step\"; replace technical jargon with business language.",
  "settings.strategy.reset": "Restore built-in",
  "settings.strategy.hint": "The built-in strategy is about 3400 characters; keep the combined total under roughly 8000. Saves when the field loses focus.",
  "settings.strategy.saved": "Strategy saved.",
  "settings.strategy.resetDone": "Built-in strategy restored.",
  "settings.strategy.resetFailed": "Save failed: the host rejected the change.",
};
var dictionaries = { zh, en };
var NS = "prompt-forge";

// src/client/styles.ts
var STYLE_ID = "dsh-prompt-forge-styles";
var CSS = `
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
`;
function ensureStyles() {
  if (document.getElementById(STYLE_ID) !== null) return false;
  const element = document.createElement("style");
  element.id = STYLE_ID;
  element.textContent = CSS;
  document.head.appendChild(element);
  return true;
}

// src/client/shortcut.ts
var MODIFIER_ALIASES = /* @__PURE__ */ new Map([
  ["ctrl", "ctrl"],
  ["control", "ctrl"],
  ["alt", "alt"],
  ["option", "alt"],
  ["shift", "shift"],
  ["meta", "meta"],
  ["cmd", "meta"],
  ["command", "meta"],
  ["win", "meta"],
  ["super", "meta"]
]);
var isKeyToken = (token) => /^[a-z0-9]$/.test(token) || /^f([1-9]|1[0-2])$/.test(token);
function codeFor(token) {
  if (/^[a-z]$/.test(token)) return `Key${token.toUpperCase()}`;
  if (/^[0-9]$/.test(token)) return `Digit${token}`;
  return `F${token.slice(1)}`;
}
function parseShortcut(spec) {
  if (spec === void 0) return null;
  const tokens = spec.trim().toLowerCase().split("+").map((token) => token.trim()).filter((token) => token !== "");
  if (tokens.length === 0 || tokens.length > 5) return null;
  const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  const last = tokens[tokens.length - 1] ?? "";
  if (!isKeyToken(last)) return null;
  for (const token of tokens.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES.get(token);
    if (modifier === void 0) return null;
    modifiers[modifier] = true;
  }
  if (!modifiers.ctrl && !modifiers.alt && !modifiers.meta) return null;
  return { ...modifiers, key: last, code: codeFor(last) };
}
function matchesShortcut(event, combo) {
  if (combo === null) return false;
  return event.ctrlKey === combo.ctrl && event.altKey === combo.alt && event.shiftKey === combo.shift && event.metaKey === combo.meta && (event.code === combo.code || event.key.toLowerCase() === combo.key);
}

// src/client/settings-source.ts
var RANK = {
  none: 0,
  legacyScope: 1,
  binder: 2,
  configForms: 3
};
function sectionOf(snapshot) {
  if (snapshot === null || typeof snapshot !== "object") return void 0;
  const record = snapshot;
  if (record.status === "unavailable") return void 0;
  return record.value;
}
function servedNamespaces(forms) {
  try {
    const namespaces = forms.describe?.()?.getSnapshot?.()?.view?.namespaces;
    return Array.isArray(namespaces) ? namespaces.map((entry) => String(entry?.ns ?? "")) : [];
  } catch {
    return [];
  }
}
function installClientSettingsSource(ctx, options) {
  let rank = RANK.none;
  const adopt = (next, section) => {
    if (section === void 0 || next < rank) return;
    rank = next;
    options.onSection(section);
  };
  const adoptSnapshot = (next, form) => {
    try {
      const section = sectionOf(form.getSnapshot?.());
      if (section !== void 0) adopt(next, section);
    } catch {
    }
  };
  ctx.inject(["configForms"], (formsCtx) => {
    const forms = formsCtx.configForms;
    if (forms === void 0 || typeof forms.get !== "function") return;
    let boundId;
    let unsubscribeForm;
    const resolveEntryId = () => {
      const served = servedNamespaces(forms);
      return options.rowIds.find((id) => served.includes(id)) ?? served.find((ns) => ns.includes("prompt-forge")) ?? options.rowIds[0];
    };
    const bind = () => {
      const entryId = resolveEntryId();
      if (entryId === void 0 || entryId === boundId) return;
      let form;
      try {
        form = forms.get?.(entryId);
      } catch {
        return;
      }
      if (form === void 0) return;
      try {
        unsubscribeForm?.();
      } catch {
      }
      unsubscribeForm = void 0;
      boundId = entryId;
      adoptSnapshot(RANK.configForms, form);
      try {
        unsubscribeForm = form.subscribe?.(() => adoptSnapshot(RANK.configForms, form));
      } catch {
        unsubscribeForm = void 0;
      }
    };
    bind();
    ctx.effect(() => () => {
      try {
        unsubscribeForm?.();
      } catch {
      }
    }, "prompt-forge: settings form mirror");
    try {
      const watch = forms.describe?.()?.subscribe?.(() => bind());
      if (typeof watch === "function") {
        ctx.effect(() => () => {
          try {
            watch();
          } catch {
          }
        }, "prompt-forge: settings namespace watch");
      }
    } catch {
    }
  });
  ctx.inject(["webUiSettings"], (binderCtx) => {
    const binder = binderCtx.webUiSettings;
    if (binder === void 0 || typeof binder.bind !== "function") return;
    let bound;
    for (const namespace of options.rowIds) {
      try {
        bound = binder.bind({ namespace });
      } catch {
        bound = void 0;
      }
      if (bound !== void 0) break;
    }
    if (bound === void 0) return;
    adoptSnapshot(RANK.binder, bound);
    let unsubscribe;
    try {
      unsubscribe = bound.subscribe?.(() => adoptSnapshot(RANK.binder, bound));
    } catch {
      unsubscribe = void 0;
    }
    ctx.effect(() => () => {
      try {
        unsubscribe?.();
      } catch {
      }
    }, "prompt-forge: settings binder mirror");
  });
  ctx.inject(["settingsScope"], (scopeCtx) => {
    const scopeCtxLike = scopeCtx;
    const scope = scopeCtxLike.settingsScope;
    if (scope === void 0 || typeof scope.bind !== "function") return;
    let bound;
    try {
      bound = scope.bind({ namespace: options.rowIds[0] ?? "prompt-forge", decode: (value) => value });
    } catch {
      return;
    }
    adoptSnapshot(RANK.legacyScope, bound);
    let unsubscribe;
    try {
      unsubscribe = bound.subscribe?.(() => adoptSnapshot(RANK.legacyScope, bound));
    } catch {
      unsubscribe = void 0;
    }
    ctx.effect(() => () => {
      try {
        unsubscribe?.();
      } catch {
      }
    }, "prompt-forge: settings scope mirror");
  });
}

// src/client/settings-page.ts
var import_react5 = require("react");
var peH = import_react5.createElement;
var LLM_CATALOG_NAMESPACES = ["llm-pi-ai"];
function overrideOf(value) {
  const record = value !== null && typeof value === "object" ? value : {};
  return {
    provider: typeof record.provider === "string" ? record.provider : "",
    model: typeof record.model === "string" ? record.model : ""
  };
}
function catalogOf(value) {
  const providers = value !== null && typeof value === "object" ? value.providers : void 0;
  if (providers === null || typeof providers !== "object") return [];
  const out = [];
  for (const [id, raw] of Object.entries(providers)) {
    if (raw === null || typeof raw !== "object") continue;
    const models = Array.isArray(raw.models) ? raw.models : [];
    const projected = [];
    for (const entry of models) {
      if (entry === null || typeof entry !== "object") continue;
      if (typeof entry.id !== "string" || entry.id === "") continue;
      projected.push({ id: entry.id, name: typeof entry.name === "string" && entry.name !== "" ? entry.name : entry.id });
    }
    if (projected.length === 0) continue;
    out.push({ id, name: typeof raw.displayName === "string" && raw.displayName !== "" ? raw.displayName : id, models: projected });
  }
  return out;
}
function peService(ctx, name) {
  try {
    if (typeof ctx.get === "function") {
      const value = ctx.get(name);
      if (value !== void 0) return value;
    }
  } catch {}
  try { return ctx[name]; } catch {}
  return void 0;
}
var DEFAULT_WEIGHTS = { recentBoost: 1, assistantBoost: 1 };
var CUSTOM_PROMPT_LIMIT = 4000;
function createSettingsPageApi(ctx) {
  const forms = peService(ctx, "configForms");
  const form = forms?.get?.("prompt-forge");
  const read = () => {
    let snapshot;
    try { snapshot = form?.getSnapshot?.(); } catch { snapshot = void 0; }
    return { ...overrideOf(snapshot?.value), writable: snapshot?.writable !== false };
  };
  const subscribe = (listener) => {
    const offs = [];
    try { const own = form?.subscribe?.(listener); if (typeof own === "function") offs.push(own); } catch {}
    try { const shared = forms?.describe?.()?.subscribe?.(listener); if (typeof shared === "function") offs.push(shared); } catch {}
    return () => { for (const off of offs) { try { off(); } catch {} } };
  };
  const save = async (next) => {
    if (form?.mutate === void 0) return false;
    const ops = next.provider !== "" && next.model !== "" ? [
      { op: "set", path: ["provider"], value: next.provider },
      { op: "set", path: ["model"], value: next.model }
    ] : [
      { op: "unset", path: ["provider"] },
      { op: "unset", path: ["model"] }
    ];
    try { return await form.mutate(ops); } catch { return false; }
  };
  const catalog = () => {
    for (const namespace of LLM_CATALOG_NAMESPACES) {
      try {
        const projected = catalogOf(forms?.get?.(namespace)?.getSnapshot?.()?.value);
        if (projected.length > 0) return projected;
      } catch {}
    }
    return [];
  };
  const readWeights = () => {
    let snapshot;
    try { snapshot = form?.getSnapshot?.(); } catch { snapshot = void 0; }
    const value = snapshot?.value !== null && typeof snapshot?.value === "object" ? snapshot.value : {};
    return {
      recentBoost: typeof value.contextRecentBoost === "number" ? value.contextRecentBoost : DEFAULT_WEIGHTS.recentBoost,
      assistantBoost: typeof value.contextAssistantBoost === "number" ? value.contextAssistantBoost : DEFAULT_WEIGHTS.assistantBoost
    };
  };
  const saveWeights = async (recentBoost, assistantBoost) => {
    if (form?.mutate === void 0) return false;
    try {
      return await form.mutate([
        { op: "set", path: ["contextRecentBoost"], value: recentBoost },
        { op: "set", path: ["contextAssistantBoost"], value: assistantBoost }
      ]);
    } catch { return false; }
  };
  const resetWeights = async () => {
    if (form?.mutate === void 0) return false;
    try {
      return await form.mutate([
        { op: "unset", path: ["contextRecentBoost"] },
        { op: "unset", path: ["contextAssistantBoost"] }
      ]);
    } catch { return false; }
  };
  const readStrategy = () => {
    let snapshot;
    try { snapshot = form?.getSnapshot?.(); } catch { snapshot = void 0; }
    const value = snapshot?.value !== null && typeof snapshot?.value === "object" ? snapshot.value : {};
    return {
      custom: typeof value.systemPrompt === "string" ? value.systemPrompt : "",
      strategyMode: typeof value.strategyMode === "string" ? value.strategyMode : "replace-default"
    };
  };
  const saveStrategy = async (text) => {
    if (form?.mutate === void 0) return false;
    try {
      if (text.trim() === "") {
        return await form.mutate([
          { op: "unset", path: ["systemPrompt"] },
          { op: "unset", path: ["strategyMode"] }
        ]);
      }
      return await form.mutate([
        { op: "set", path: ["systemPrompt"], value: text },
        { op: "set", path: ["strategyMode"], value: "extend-default" }
      ]);
    } catch { return false; }
  };
  const resetStrategy = async () => saveStrategy("");
  let bound;
  try { bound = peService(ctx, "locale")?.bind?.("prompt-forge"); } catch { bound = void 0; }
  const t = (key) => {
    if (bound === void 0) {
      try { bound = peService(ctx, "locale")?.bind?.("prompt-forge"); } catch { bound = void 0; }
    }
    if (bound !== void 0) {
      try { const text = bound(key); if (typeof text === "string" && text !== "") return text; } catch {}
    }
    const fallback = zh[key];
    return fallback !== void 0 ? fallback : key;
  };
  return {
    read, subscribe, save, catalog,
    readWeights, saveWeights, resetWeights,
    readStrategy, saveStrategy, resetStrategy,
    t
  };
}
var MENU_MAX_HEIGHT = 240;
function Dropdown(props) {
  const { value, options, placeholder, disabled, onChange } = props;
  const [open, setOpen] = import_react5.useState(false);
  const [anchor, setAnchor] = import_react5.useState(void 0);
  const triggerRef = import_react5.useRef(null);
  const menuRef = import_react5.useRef(null);
  import_react5.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (target !== null && menuRef.current !== null && menuRef.current.contains(target)) return;
      if (target !== null && triggerRef.current !== null && triggerRef.current.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    const onScroll = (event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current !== null && menuRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);
  const current = options.find((option) => option.id === value);
  const toggle = () => {
    if (disabled === true) return;
    const rect = triggerRef.current === null ? void 0 : triggerRef.current.getBoundingClientRect();
    setAnchor(rect === void 0 ? void 0 : { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width });
    setOpen(!open);
  };
  const openUp = anchor !== void 0 && window.innerHeight - anchor.bottom < MENU_MAX_HEIGHT && anchor.top > MENU_MAX_HEIGHT;
  return peH("div", { className: "dsh-pf-dd" },
    peH("button", {
      ref: triggerRef,
      type: "button",
      className: "dsh-pf-dd-btn" + (open ? " is-open" : "") + (current === void 0 ? " is-empty" : ""),
      disabled: disabled === true,
      "aria-haspopup": "listbox",
      "aria-expanded": open,
      onClick: toggle
    },
      peH("span", { className: "dsh-pf-dd-value" }, current !== void 0 ? current.name : placeholder),
      peH("span", { className: "dsh-pf-dd-caret", "aria-hidden": true })),
    open && anchor !== void 0 && (0, import_react_dom.createPortal)(
      peH("div", {
        ref: menuRef,
        className: "dsh-pf-dd-menu",
        role: "listbox",
        style: openUp
          ? { bottom: window.innerHeight - anchor.top + 4 + "px", left: anchor.left + "px", minWidth: anchor.width + "px" }
          : { top: anchor.bottom + 4 + "px", left: anchor.left + "px", minWidth: anchor.width + "px" }
      },
        options.length === 0 && peH("div", { className: "dsh-pf-dd-empty" }, placeholder),
        options.map((option) => peH("button", {
          key: option.id,
          type: "button",
          role: "option",
          "aria-selected": option.id === value,
          className: "dsh-pf-dd-item" + (option.id === value ? " is-on" : ""),
          onMouseDown: (event) => {
            event.preventDefault();
            onChange(option.id);
            setOpen(false);
          },
          onClick: () => onChange(option.id)
        }, option.name))),
      document.body));
}
function SettingsSection(props) {
  const { api } = props;
  const t = api.t;
  const [stored, setStored] = import_react5.useState(() => api.read());
  const [weightDraft, setWeightDraft] = import_react5.useState(() => {
    const current = api.readWeights();
    return { recent: String(current.recentBoost), assistant: String(current.assistantBoost) };
  });
  const [strategy, setStrategy] = import_react5.useState(() => api.readStrategy());
  const [strategyText, setStrategyText] = import_react5.useState(() => api.readStrategy().custom);
  const [useCustom, setUseCustom] = import_react5.useState(() => api.readStrategy().custom.trim() !== "");
  const [catalog, setCatalog] = import_react5.useState(() => api.catalog());
  const [mode, setMode] = import_react5.useState(() => api.read().provider !== "" ? "fixed" : "follow");
  const [provider, setProvider] = import_react5.useState(() => api.read().provider);
  const [model, setModel] = import_react5.useState(() => api.read().model);
  const [manual, setManual] = import_react5.useState(false);
  const [saving, setSaving] = import_react5.useState(false);
  const [notice, setNotice] = import_react5.useState(void 0);
  import_react5.useEffect(() => api.subscribe(() => {
    setStored(api.read());
    const next = api.readWeights();
    setWeightDraft({ recent: String(next.recentBoost), assistant: String(next.assistantBoost) });
    const nextStrategy = api.readStrategy();
    setStrategy(nextStrategy);
    setStrategyText(nextStrategy.custom);
    setUseCustom(nextStrategy.custom.trim() !== "");
    setCatalog(api.catalog());
  }), [api]);
  import_react5.useEffect(() => {
    if (mode !== "fixed" || provider !== "" || catalog.length === 0) return;
    const first = catalog[0];
    if (first !== void 0) setProvider(first.id);
  }, [mode, provider, catalog]);
  const modelsOf = import_react5.useMemo(() => {
    const group = catalog.find((entry) => entry.id === provider);
    return group !== void 0 ? group.models : [];
  }, [catalog, provider]);
  const useSelects = catalog.length > 0 && !manual;
  const dirty = mode === "follow" ? stored.provider !== "" : provider !== stored.provider || model !== stored.model;
  const pairMissing = mode === "fixed" && (provider === "" || model === "");
  const effective = stored.provider !== "" && stored.model !== ""
    ? stored.provider + " · " + stored.model
    : t("settings.mode.follow");
  const strategyChars = Array.from(strategyText).length;
  const commit = (next) => {
    setSaving(true);
    setNotice(void 0);
    void api.save(next).then((ok) => {
      setSaving(false);
      setNotice(ok ? { ok: true, text: t("settings.saved") } : { ok: false, text: t("settings.saveFailed") });
    });
  };
  const onSave = () => {
    if (pairMissing) {
      setNotice({ ok: false, text: t("settings.needPair") });
      return;
    }
    commit(mode === "fixed" ? { provider, model } : { provider: "", model: "" });
  };
  const onReset = () => {
    setMode("follow");
    setProvider("");
    setModel("");
    commit({ provider: "", model: "" });
  };
  const commitStrategy = (text) => {
    if (text === api.readStrategy().custom) return;
    setSaving(true);
    setNotice(void 0);
    void api.saveStrategy(text).then((ok) => {
      setSaving(false);
      setNotice(ok ? { ok: true, text: t("settings.strategy.saved") } : { ok: false, text: t("settings.strategy.resetFailed") });
    });
  };
  const pickStrategy = (custom) => {
    setUseCustom(custom);
    setNotice(void 0);
    if (!custom) {
      setStrategyText("");
      commitStrategy("");
    }
  };
  const onResetStrategy = () => {
    setUseCustom(false);
    setStrategyText("");
    if (api.readStrategy().custom === "") {
      setNotice({ ok: true, text: t("settings.strategy.resetDone") });
      return;
    }
    setSaving(true);
    setNotice(void 0);
    void api.resetStrategy().then((ok) => {
      setSaving(false);
      setNotice(ok ? { ok: true, text: t("settings.strategy.resetDone") } : { ok: false, text: t("settings.strategy.resetFailed") });
    });
  };
  const commitWeights = () => {
    const recent = Number(weightDraft.recent);
    const assistant = Number(weightDraft.assistant);
    const current = api.readWeights();
    if (recent === current.recentBoost && assistant === current.assistantBoost) return;
    if (!Number.isFinite(recent) || recent < 1 || recent > 3 || !Number.isFinite(assistant) || assistant < 1 || assistant > 3) {
      setNotice({ ok: false, text: t("settings.weight.invalid") });
      return;
    }
    setSaving(true);
    setNotice(void 0);
    void api.saveWeights(recent, assistant).then((ok) => {
      setSaving(false);
      setNotice(ok ? { ok: true, text: t("settings.weight.saved") } : { ok: false, text: t("settings.weight.resetFailed") });
    });
  };
  const onResetWeights = () => {
    setSaving(true);
    setNotice(void 0);
    void api.resetWeights().then((ok) => {
      setSaving(false);
      setNotice(ok ? { ok: true, text: t("settings.weight.resetDone") } : { ok: false, text: t("settings.weight.resetFailed") });
    });
  };
  const option = (name, checked, title, desc, onPick) => peH("label", { className: "dsh-pf-opt" + (checked ? " is-on" : "") },
    peH("input", { type: "radio", name, checked, onChange: onPick }),
    peH("span", { className: "dsh-pf-opt-text" },
      peH("span", { className: "dsh-pf-opt-title" }, title),
      peH("span", { className: "dsh-pf-opt-desc" }, desc)));
  const row = (label, control) => peH("div", { className: "dsh-pf-row" },
    peH("span", { className: "dsh-pf-row-label" }, label),
    peH("div", { className: "dsh-pf-row-control" }, control));
  const weightRow = (label, value, onChange) => peH("div", { className: "dsh-pf-wrow" },
    peH("span", { className: "dsh-pf-wrow-label" }, label),
    peH("span", { className: "dsh-pf-wrow-control" },
      peH("span", { className: "dsh-pf-wrow-times" }, "×"),
      peH("input", {
        className: "dsh-pf-wnum",
        type: "number",
        min: 1,
        max: 3,
        step: 0.1,
        value,
        onChange: (event) => onChange(event.target.value),
        onBlur: () => commitWeights()
      })));
  const textField = (key) => peH("input", {
    className: "dsh-pf-input",
    value: key === "provider" ? provider : model,
    placeholder: key === "provider" ? "provider（如 zhipu）" : "model（如 glm-5.3-flash）",
    onChange: (event) => {
      if (key === "provider") setProvider(event.target.value);
      else setModel(event.target.value);
    }
  });
  const providerControl = peH(Dropdown, {
    value: provider,
    options: catalog.map((group) => ({ id: group.id, name: group.name })),
    placeholder: t("settings.provider.placeholder"),
    onChange: (next) => {
      setProvider(next);
      setModel("");
    }
  });
  const modelControl = peH(Dropdown, {
    value: model,
    options: modelsOf.map((entry) => ({ id: entry.id, name: entry.name })),
    placeholder: provider === "" ? t("settings.needProvider") : t("settings.model.placeholder"),
    disabled: provider === "",
    onChange: setModel
  });
  return peH("div", { className: "dsh-pf-set" },
    peH("div", { className: "dsh-pf-set-head" },
      peH("div", { className: "dsh-pf-title-row" },
        peH("h2", { className: "dsh-pf-set-h2" }, t("settings.title")),
        peH("span", { className: "dsh-pf-badge" + (dirty ? " is-dirty" : "") },
          dirty ? t("settings.unsavedBadge") : effective)),
      peH("p", { className: "dsh-pf-set-sub" }, t("settings.sub"))),
    peH("section", { className: "dsh-pf-group" },
      peH("div", { className: "dsh-pf-group-head" },
        peH("h3", { className: "dsh-pf-group-title" }, t("settings.group.model")),
        catalog.length > 0 && peH("button", {
          type: "button",
          className: "dsh-pf-link",
          onClick: () => setManual(!manual)
        }, manual ? t("settings.useCatalog") : t("settings.useManual"))),
      peH("div", { className: "dsh-pf-opts" },
        option("dsh-pf-model-mode", mode === "follow", t("settings.mode.follow"), t("settings.mode.follow.desc"), () => {
          setMode("follow");
          setNotice(void 0);
        }),
        option("dsh-pf-model-mode", mode === "fixed", t("settings.mode.fixed"), t("settings.mode.fixed.desc"), () => {
          setMode("fixed");
          setNotice(void 0);
        })),
      mode === "fixed" && peH("div", { className: "dsh-pf-form" },
        useSelects ? [
          row(t("settings.provider"), providerControl),
          row(t("settings.model"), modelControl)
        ] : [
          row(t("settings.provider"), textField("provider")),
          row(t("settings.model"), textField("model"))
        ],
        catalog.length === 0 && peH("p", { className: "dsh-pf-hint" }, t("settings.catalog.empty")))),
    peH("div", { className: "dsh-pf-set-foot" },
      peH("span", {
        className: "dsh-pf-set-notice" + (notice !== void 0 ? notice.ok ? " is-ok" : " is-bad" : stored.writable === false ? " is-bad" : "")
      }, notice !== void 0 ? notice.text : stored.writable === false ? t("settings.readonly") : dirty ? t("settings.unsaved") : ""),
      peH("div", { className: "dsh-pf-foot-actions" },
        peH("button", {
          type: "button",
          className: "dsh-pf-btn-action plain",
          disabled: saving || stored.provider === "",
          onClick: onReset
        }, t("settings.reset")),
        peH("button", {
          type: "button",
          className: "dsh-pf-btn-action primary",
          disabled: saving || pairMissing || stored.writable === false,
          onClick: onSave
        }, saving ? t("settings.saving") : t("settings.save")))));
}

// src/client/index.tsx
var inject = [];
function report(step, error) {
  try {
    console.warn(`[prompt-forge] ${step} failed; that feature stays off.`, error);
  } catch {
  }
  return () => {
  };
}
function apply(ctx) {
  ensureStyles();
  ctx.inject(["locale"], (localeCtx) => {
    ctx.effect(() => {
      try {
        return localeCtx.locale.register(NS, dictionaries);
      } catch (error) {
        return report("dictionary registration", error);
      }
    }, "dsh-prompt-forge: dictionaries");
  });
  setClientSettings(decodeClientSettings(void 0));
  installClientSettingsSource(ctx, {
    rowIds: PROMPT_FORGE_ROW_IDS,
    onSection: (section) => setClientSettings(decodeClientSettings(section))
  });
  ctx.inject(["slots"], (slotsCtx) => {
    const slots = slotsCtx.slots;
    if (slots === void 0) return;
    return slots.inject("conversation.input.right", () => {
      try {
        return slots.register(
          { name: "conversation.input.right", id: "prompt-forge", order: 60, locale: NS },
          EnhanceButton
        );
      } catch (error) {
        return report("composer enhance button slot", error);
      }
    });
  });
  ctx.inject(["configForms", "slots"], (slotsCtx) => {
    const slots = slotsCtx.slots;
    if (slots === void 0) return;
    return slots.inject("settings.section", () => {
      try {
        const api = createSettingsPageApi(slotsCtx);
        return slots.register(
          {
            name: "settings.section",
            id: "prompt-forge",
            order: 60,
            locale: NS,
            label: () => api.t("settings.nav"),
            inject: () => ({ api })
          },
          SettingsSection
        );
      } catch (error) {
        return report("settings section", error);
      }
    });
  });
  // v0.4: the dock undo bar is intentionally not registered — the ✨ button
  // itself becomes the revert trigger once a result is applied, so a second
  // permanent strip above the composer was redundant and covered the message
  // about to be sent. The undo stack is kept: it is what peekUndo() reads.
  // To restore it, register UndoBar on "conversation.input.dock" again.
  ctx.effect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      const settings = getClientSettings();
      if (!settings.enabled) return;
      const combo = parseShortcut(settings.shortcut);
      if (!matchesShortcut(event, combo)) return;
      const target = shortcutTarget();
      if (target === void 0) return;
      event.preventDefault();
      event.stopPropagation();
      target();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, "dsh-prompt-forge: shortcut");
}

		return module.exports;
	}
});

