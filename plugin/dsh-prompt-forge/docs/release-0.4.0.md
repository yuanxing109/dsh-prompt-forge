# 0.4.0 — Prompt Forge

**Release date:** 2026-11-14 · **Package id:** `dsh-prompt-forge` · **Scope:** rename and rebrand only. The enhancement pipeline, prompt strategy, guards, model routing, and UI behavior are unchanged from 0.3.4.

## What changed

| Area | After |
|---|---|
| Package / plugin id | `dsh-prompt-forge` |
| Display name | Prompt Forge |
| Settings section key | `prompt-forge` (Settings → 插件配置 → `prompt-forge`) |
| HTTP routes | `/prompt-forge/enhance`, `/prompt-forge/enhance-stream` |
| DOM / CSS class prefix | `dsh-pf-` |
| Slash command | `/enhance` (unchanged) |
| Default shortcut | `Ctrl+Alt+E` (unchanged) |
| Repository | https://github.com/yuanxing109/dsh-prompt-forge |

## Upgrading from 0.3.x

The package id, the settings section key, the route prefix, and the CSS prefix all changed, so an in-place upgrade is a re-install:

1. Remove the previous entry — `dsh plugin --profile web remove <previous-id>`
2. Install the new one — `dsh plugin --profile web add github:yuanxing109/dsh-prompt-forge`
3. Restart `dsh web` (host half and client bundle are both replaced)
4. Open Settings → 插件配置 → `prompt-forge` and re-enter provider/model, strategy mode, and custom system prompt. Values are **not** migrated: the settings namespace is keyed by the new section id.
5. If the profile's `package.json` still carries a stale row under `dsh.profile.bundles`, delete that row — a leftover entry keeps the old bundle in the loader tree.

## Unchanged

- Local guards: empty draft, over-long draft (no silent truncation), image-only draft, and drafts containing slash-command or file-reference chips are refused before any model call.
- Strategy: `extend-default` / `replace-default`, with the built-in hard rules on the default path.
- Model routing: settings pair → current session model → harness default.
- Error codes and browser-side localization.
- Undo, copy, and discard in the preview panel.

---

# 0.4.0 — Prompt Forge（中文）

**发布日期：** 2026-11-14 · **包名：** `dsh-prompt-forge` · **范围：** 只改名字与品牌，增强流程、提示词策略、本地守卫、模型路由、界面行为与 0.3.4 完全一致。

## 改了什么

| 项目 | 现在的值 |
|---|---|
| 包名 / 插件 id | `dsh-prompt-forge` |
| 显示名 | Prompt Forge |
| 设置段 key | `prompt-forge`（设置 → 插件配置 → `prompt-forge`） |
| HTTP 路由 | `/prompt-forge/enhance`、`/prompt-forge/enhance-stream` |
| DOM / CSS 类前缀 | `dsh-pf-` |
| 斜杠命令 | `/enhance`（未变） |
| 默认快捷键 | `Ctrl+Alt+E`（未变） |
| 仓库地址 | https://github.com/yuanxing109/dsh-prompt-forge |

## 从 0.3.x 升级

包名、设置段 key、路由前缀、样式前缀全部换了，所以只能"卸旧装新"：

1. 先卸旧条目：`dsh plugin --profile web remove <旧包名>`
2. 再装新条目：`dsh plugin --profile web add github:yuanxing109/dsh-prompt-forge`
3. 重启 `dsh web`（宿主半区与浏览器 bundle 都要重载）
4. 打开 设置 → 插件配置 → `prompt-forge`，重新填 provider/model、策略模式、自定义 system prompt。**不会自动迁移**：设置按新的段 id 存放。
5. 如果 profile 的 `package.json` 里 `dsh.profile.bundles` 下还留着旧行，删掉它 —— 残留行会让旧 bundle 继续挂在 loader 树上。

## 没变的

- 本地守卫：空草稿、超长草稿（不静默截断）、纯图片草稿、含斜杠命令或文件引用 chip 的草稿，一律在调用模型前拒绝。
- 策略：`extend-default` / `replace-default`，默认路径保留内置硬规则。
- 模型路由：设置对 → 当前会话模型 → harness 默认模型。
- 错误码与浏览器端本地化文案。
- 预览面板的应用、复制、丢弃、撤销。
