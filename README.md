# dsh-prompt-forge 离线安装包（0.4.0 · 你的修改版）

把 `dsh-prompt-forge` 插件连同它的修改一起装到任意一台 Windows 的 DeepSeek Harness 里：双击 `install.bat` 安装，双击 `uninstall.bat` 回滚，`verify.bat` 逐项核对结果。全程不依赖 npm registry 上的同名包，装的就是包内这份代码。

仓库：<https://github.com/yuanxing109/dsh-prompt-forge> —— `plugin/dsh-prompt-forge/` 是插件本体，`lib/` 已编译并随仓库提交。

---

## 1. 适用环境

| 项目 | 要求 | 本机实测 |
|---|---|---|
| 操作系统 | Windows 10 1809+ / Windows 11（x64 / arm64） | Windows（Desktop 被重定向到 `D:\Documents\Desktop`） |
| PowerShell | 5.1 及以上（系统自带即可，脚本按 5.1 语法编写） | 系统自带 5.1 + pwsh 7.6 |
| DSH | 插件声明 `dsh >=0.1.1-rc.2 <0.3.0` | 0.2.2-rc.1 |
| Node | `^22.19.0 || >=24.0.0`（优先用 DSH 自带 node） | v24.21.0 |
| pnpm | 优先 DSH 自带 pnpm，其次 PATH；都没有则退回 junction | DSH 自带 pnpm 11.28.5 / PATH pnpm 12.15.0 |
| DSH 用户目录 | 已初始化：`%USERPROFILE%\.dsh\profiles\<profile>\package.json` | `C:\Users\<你>\.dsh\profiles\desktop` |

脚本不写死任何本机路径：DSH 安装目录按「参数 → 注册表 Uninstall 项 → 运行进程 → `%LOCALAPPDATA%\Programs\DeepSeek Harness` → `%ProgramFiles%`」顺序探测；profile 按「参数 → `desktop` → 唯一存在的 profile」顺序确定；桌面路径只在打包时用到，安装时不需要。

---

## 2. 打包后的目录结构

```
dsh-prompt-forge\
├─ install.bat                  # 双击入口 → install.ps1
├─ install.ps1                  # 安装：校验 → 探测环境 → 复制 vendor → 改清单 → pnpm 接线 → 自动校验
├─ uninstall.bat                # 双击入口 → uninstall.ps1
├─ uninstall.ps1                # 卸载：还原清单 → 清理 node_modules → 删 vendor → 自动校验
├─ verify.bat / verify.ps1      # 校验器：-Mode install | uninstall
├─ README.md                    # 本文件
├─ package-manifest.json        # 52 个文件的 SHA-256、版本、engines（安装前校验用）
├─ tools\
│  ├─ patch-profile.mjs         # 只改 profile package.json：add / remove / status（含备份与还原）
│  └─ build-manifest.mjs        # 重新生成 package-manifest.json
└─ plugin\
   └─ dsh-prompt-forge\         # 你修改过的插件本体（52 文件 / 1.37 MB）
      ├─ package.json           # v0.4.0, type=module, dsh.bundle.patch=./cordis.patch.yml
      ├─ cordis.patch.yml       # bundle 补丁（插入插件行）
      ├─ lib\index.js           # 宿主半区（已编译）
      ├─ lib\client.js          # 浏览器半区（已编译，你的改动在这里）
      ├─ lib\client.js.pre-v04.bak   # 你的改动前备份，一并保留
      ├─ src\**                # TS/TSX 源码（含 client/*、enhance-routes.ts、enhancer.ts…）
      ├─ docs\**               # 版本说明与截图
      └─ README.md / README.zh-CN.md / LICENSE
```

包内不含 `node_modules`：插件的唯一运行时依赖 `@deepseek-ai/schemastery` 由目标机 profile 自己的 `pnpm install` 解析，跟其它插件共用同一套依赖树。

---

## 3. 安装

### 3.1 双击方式

双击 `install.bat`。脚本会自动：校验包完整性 → 找 DSH/Node/pnpm → 要求 DSH 已退出 → 装进 profile → 自动跑校验。

### 3.2 命令行方式

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
# 指定 profile / 强制结束 DSH / 装完直接启动
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -Profile desktop -Force -Launch
# 无 pnpm 的机器（纯离线、只建 junction）
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -NoPnpm
```

| 参数 | 作用 |
|---|---|
| `-Profile <name>` | 指定 profile，默认自动探测（优先 `desktop`） |
| `-DshHome <dir>` | 指定 DSH 用户目录，默认 `%USERPROFILE%\.dsh` 或 `$env:DSH_HOME` |
| `-DshRoot <dir>` | 指定 DSH 安装根目录，默认自动探测 |
| `-Force` | 检测到 DeepSeek Harness 进程时强制结束（不加则直接报错让你手动退出） |
| `-NoPnpm` | 跳过 pnpm install，直接建立 `node_modules\dsh-prompt-forge` junction |
| `-SkipIntegrityCheck` | 跳过包内文件 SHA-256 校验 |
| `-SkipProcessCheck` | 跳过运行进程检测（仅自动化/CI 用） |
| `-SkipVerify` | 安装后不自动跑 verify.ps1 |
| `-Launch` | 安装完成后启动 DSH |
| `-NoPause` | 结束时不等待回车 |

### 3.3 安装做了什么

1. **校验**：按 `package-manifest.json` 逐文件比对 SHA-256，防止复制不完整或被篡改。
2. **探测**：DSH 安装目录 → 自带 node（`resources\runtime\primary-runtime\dependencies\node\bin\node.exe`）与自带 pnpm（同目录 `...\pnpm\bin\pnpm.cjs`）；都没有才回退 PATH。校验 Node 版本满足 `^22.19.0 || >=24.0.0`。
3. **复制**：`plugin\dsh-prompt-forge` → `<profile>\vendor\dsh-prompt-forge`（robocopy 镜像）。
4. **改清单**（先备份）：
   - `package.json` 的依赖写成 `"dsh-prompt-forge": "file:./vendor/dsh-prompt-forge"`；
   - `dsh.profile.bundles` 去重并确保含 `dsh-prompt-forge`；
   - 备份文件：`package.json.pre-prompt-forge-pack`、`pnpm-lock.yaml.pre-prompt-forge-pack`。
5. **接线**：在 profile 目录跑 `pnpm install --prefer-offline`，把 vendor 以 link 形式接入 `node_modules`（node 解析到 vendor，改 vendor 里的文件即改运行代码）。pnpm 不可用或失败时退回 `node_modules\dsh-prompt-forge` junction，并提示日志路径。
6. **自检**：自动调用 `verify.ps1 -Mode install`，失败即返回非 0。

装完需要**完全退出 DSH（含托盘）再启动**，新代码才会加载。

---

## 4. 卸载

双击 `uninstall.bat`（等价于 `powershell -NoProfile -ExecutionPolicy Bypass -File uninstall.ps1`），参数同上（`-Profile`/`-DshHome`/`-DshRoot`/`-Force`/`-SkipVerify`/`-NoPause`）。

卸载顺序：

1. 确认 DSH 已退出（或 `-Force`）；
2. `tools\patch-profile.mjs remove`：**有安装前备份就整体还原** `package.json` 与 `pnpm-lock.yaml`；没有备份则只剥离依赖与 bundle 条目；
3. `pnpm install` 清理 `node_modules` 接线（失败则手动移除指向 vendor 的 junction）；
4. 删除 `<profile>\vendor\dsh-prompt-forge`（空掉的 `vendor` 目录一并删除）；
5. 自动调用 `verify.ps1 -Mode uninstall`。

**卸载语义**：回到「安装之前」的状态。如果这台机器装之前就有 registry 版 `dsh-prompt-forge`，卸载会把清单还原成原来的版本写法（本机为 `0.3.4`），pnpm 会把它装回来；你的修改版仍在桌面包里，随时可再装。要连原版一起移除，请到 DSH 插件管理器里再卸一次。

---

## 5. 验证安装 / 卸载是否成功

### 5.1 自动校验（脚本）

```powershell
verify.bat                                  # 等价 -Mode install
powershell -NoProfile -ExecutionPolicy Bypass -File verify.ps1 -Mode uninstall
```

| 模式 | 检查项 | 通过标准 |
|---|---|---|
| install | 依赖写法 | `package.json` 中为 `file:./vendor/dsh-prompt-forge` |
| install | bundle 注册 | `dsh.profile.bundles` 中恰好 1 条 `dsh-prompt-forge` |
| install | 必要文件 | vendor 下 `package.json`、`cordis.patch.yml`、`lib\index.js`、`lib\client.js` 齐全 |
| install | 版本 | vendor 版本 = 包版本（0.3.4） |
| install | 文件哈希 | 51 个文件 SHA-256 与 `package-manifest.json` 全一致 |
| install | node_modules 解析 | `node_modules\dsh-prompt-forge\package.json` 与 vendor 同哈希（同一份文件） |
| install | lockfile | `pnpm-lock.yaml` 记录 `vendor/dsh-prompt-forge`（junction 模式可能为 WARN） |
| install | 进程状态 | 提示是否需重启 |
| uninstall | 依赖清理 | 依赖不再是 `file:./vendor/...`（已还原或已删除） |
| uninstall | bundle 一致性 | 有 `node_modules` 条目则保留 1 条，无条目则 0 条 |
| uninstall | vendor 目录 | 已删除 |
| uninstall | 接线 | 不再指向 vendor |
| uninstall | lockfile | 无 vendor 记录 |

判定：任一项 **FAIL** → 退出码 1；只有 **WARN** → 退出码 0。输出逐行 `PASS/WARN/FAIL + 检查项 + 明细`，末尾给出 `结论: PASS/FAIL`。

### 5.2 手工 GUI 验证（install 之后）

1. 完全退出 DSH（含托盘）后重新启动，新建会话。
2. 输入框右侧、发送键旁出现 **「增强」按钮**；点击弹出**原文 / 增强结果并排**的预览面板，带模型名与耗时。
3. 点「回填」后输入框上方出现**撤销条**，点「撤销」恢复原文（失败路径不应改动草稿）。
4. 光标在输入框内按 **Ctrl+Alt+E**（默认快捷键）触发同样流程。
5. 斜杠命令面板里出现 **`/enhance`**。
6. **设置 → 插件配置** 出现「提示词增强」设置项（模型覆盖 / 温度 / 预算 / 系统提示词 / 快捷键），改动即时生效。
7. 以上任一缺失时看日志：`%USERPROFILE%\.dsh\logs` 最新日志里 `dsh-prompt-forge` 行是否有加载错误。

### 5.3 手工 GUI 验证（uninstall 之后）

1. 重启 DSH，新建会话：**没有**「增强」按钮，Ctrl+Alt+E 无反应，`/enhance` 不在命令面板。
2. **设置 → 插件配置** 中「提示词增强」设置项消失。
3. 日志中不再出现该插件的加载行。

---

## 6. 故障排查

| 现象 | 处理 |
|---|---|
| 双击后窗口一闪而过 | 用命令行跑 `powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1` 看报错 |
| `无法加载文件…未数字签名` | 已在 .bat 中带 `-ExecutionPolicy Bypass`；手动执行时也要带该参数 |
| `未找到 DSH 用户目录` | 先启动一次 DSH 桌面版完成初始化，或 `-DshHome` 指定 |
| `DeepSeek Harness 正在运行` | 完全退出（含托盘/后台进程）后重试，或 `-Force` |
| `未找到 Node 运行时` | 安装 Node.js 22.19+ 或 24+，或 `-DshRoot` 指向含 `resources\runtime` 的 DSH 目录 |
| pnpm install 报 `ERR_PNPM_...` | 看 `<profile>\vendor\dsh-prompt-forge\.install\pnpm-install-*.log`；离线机器可加 `-NoPnpm`（junction 安装，功能等价） |
| 装完按钮不出现 | 确认已重启；verify.bat 全 PASS 仍不出现则查日志与 DSH 版本是否在声明区间 |
| 卸载后想彻底清除 | 卸载只还原安装前状态；要移除原有 registry 版，去 DSH 插件管理器卸载 |

---

## 7. 更新包内插件（以后改了代码再打包）

```powershell
# 1) 用当前运行中的版本覆盖包内插件（假设 DSH 已在 profile 里 link 到 vendor）
robocopy "$env:USERPROFILE\.dsh\profiles\desktop\vendor\dsh-prompt-forge" "dsh-prompt-forge\plugin\dsh-prompt-forge" /MIR /XD node_modules .git
# 2) 重新生成哈希清单
node "dsh-prompt-forge\tools\build-manifest.mjs"
```
`node` 用 DSH 自带的可执行文件亦可：
`D:\Tool\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe`。

---

## 8. 包内文件与 profile 的对应关系（速查）

| 包内 | 安装后 |
|---|---|
| `plugin\dsh-prompt-forge\` | `<profile>\vendor\dsh-prompt-forge\` |
| `tools\patch-profile.mjs` | 只被脚本调用，不落地 |
| `package-manifest.json` | 校验基准，不落地 |
| 备份文件 | `<profile>\package.json.pre-prompt-forge-pack`、`<profile>\pnpm-lock.yaml.pre-prompt-forge-pack` |
