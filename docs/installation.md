# 安装与分发指南

## 环境与工具

- Node.js 22.20.0 或更高版本。
- 已配置可用的 Claude Code 或 Codex，以及所需模型访问。
- Vercel `skills` CLI 1.7.2，使用标准 `SKILL.md` 发现与安装技能。

以下命令适用于 macOS/Linux。`DISABLE_TELEMETRY=1` 关闭安装工具遥测。Windows 安装方式尚未验证。

## 在线安装

### GitHub 来源

在目标项目目录执行：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add coder-zhuzm/yuyin-skills \
  -s yuyin-dev -a claude-code -a codex -y
```

### 本地源码

克隆仓库后，在目标项目目录执行，将路径替换为实际来源目录：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add /path/to/yuyin-skills/skills/development/shared \
  -s yuyin-dev -a claude-code -a codex -y
```

### npm 内容包

将内容包安装到独立目录，再通过 `skills` CLI 接入目标项目：

```bash
npm install --prefix "$HOME/.local/share/yuyin-skills-package" \
  @zhuzm/yuyin-skills@0.3.0 --ignore-scripts --no-audit --no-fund

DISABLE_TELEMETRY=1 npx skills@1.7.2 add \
  "$HOME/.local/share/yuyin-skills-package/node_modules/@zhuzm/yuyin-skills/skills/development/shared" \
  -s yuyin-dev -a claude-code -a codex -y
```

npm 负责内容分发，`skills` CLI 负责 Agent 接入。内容包无运行时依赖。

默认安装到当前项目。仅使用 Claude Code 时保留 `-a claude-code`，仅使用 Codex 时保留 `-a codex`；用户级安装添加 `-g`。需要独立副本时添加 `--copy`。

## 离线安装

离线归档由维护者按本文打包流程生成，可命名为 `yuyin-skills-v0.3.0-offline.zip`。归档包含源码、内容 tgz、已安装的 `skills` CLI、锁定依赖及许可证。

解压后将来源目录放在稳定位置。在目标项目目录执行：

```bash
PACK="/path/to/yuyin-skills-v0.3.0"
node --version
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" \
  add "$PACK/skills/development/shared" -s yuyin-dev -a claude-code -a codex -y
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" \
  list -a claude-code -a codex
```

首次离线安装使用归档内的 CLI，避免 `npx` 尝试下载安装工具。环境中已有 `skills@1.7.2` 时可复用现有安装。

也可先安装归档中的 npm 内容包，再接入 Agent：

```bash
npm install --prefix "$HOME/.local/share/yuyin-skills-package" \
  "$PACK/zhuzm-yuyin-skills-0.3.0.tgz" \
  --offline --no-update-notifier --ignore-scripts --no-audit --no-fund

DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" add \
  "$HOME/.local/share/yuyin-skills-package/node_modules/@zhuzm/yuyin-skills/skills/development/shared" \
  -s yuyin-dev -a claude-code -a codex -y
```

离线归档提供技能与安装工具；模型、网关和代理仍由目标环境配置。

## 更新、回退与移除

项目安装时，CLI 将源码复制到 `.agents/skills/yuyin-dev`，Claude Code 的 `.claude/skills/yuyin-dev` 链接到该副本，Codex 读取标准目录。实际路径以 CLI 输出和 `list` 结果为准。

安装副本与来源目录独立。修改源码或升级 npm 内容包后，在每个目标项目重新执行 `add`，并开启新 Agent 会话。同名安装副本可能被覆盖，个人修改应保存在独立来源目录。

版本回退使用保留的旧源码快照重新执行 `add`。离线安装需明确指定本地来源；`skills check/update` 适用于可访问的上游来源。

完整移除当前项目中 `yuyin-dev` 的安装入口：

```bash
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" \
  remove yuyin-dev -y
```

如只移除指定 Agent 的入口，可添加 `-a claude-code` 或 `-a codex`；其他 Agent 仍使用的共享目录可能保留。移除用户级安装时添加 `-g`。执行覆盖或移除前，应备份安装副本中的手动修改；`-y` 仅用于跳过交互确认。

## 项目上下文与验收

CLI 仅安装技能，保留现有 `CLAUDE.md`、`AGENTS.md`、`.gitignore` 和项目事实。项目上下文模板按需要手动采用：

| 模板 | 用途 |
| --- | --- |
| `templates/project.md` | 项目入口、技术栈、启动与检查命令 |
| `templates/constraints.md` | 业务边界与实施约束 |
| `templates/glossary.md` | 领域术语与统一定义 |
| `templates/task.md` | 复杂或跨会话任务状态 |

可将模板放入目标项目的 `.ai-dev/`，填写实际信息，并在现有规则入口中引用。规则参考见 `rules/team-rules.md`；副本、链接和项目记录的 Git 跟踪策略由目标项目维护。

安装后开启新会话，先验证只读逻辑梳理：

```text
Claude Code: /yuyin-dev 逻辑 梳理项目主流程，列出入口、调用链和重要分支，先不修改代码。
Codex: $yuyin-dev 逻辑 梳理项目主流程，先不修改代码。
```

随后使用真实 Bug 和小功能验证改动范围、回归结果与证据完整性。文件安装检查与 Agent 运行时验证应分别记录。

## 旧版迁移

v0.1/v0.2 使用自制安装器。迁移前备份目标项目中的手动修改，再使用已安装的旧版工具解除接入：

```bash
# v0.2
yuyin-dev detach --project "/path/to/project"

# v0.1
python3 tools/devpack.py detach --project "/path/to/project"
```

随后在目标项目执行新的 `skills add`。旧工具与新 CLI 应分别完成移除和安装，避免同时管理同名入口。若旧元数据或链接已被修改，应先检查状态与实际路径，再处理迁移。

历史工具说明见 `docs/history/`。

## 维护与发布

通用开发技能的源码为 `skills/development/shared/yuyin-dev/`。新增技能使用对应分类目录，并更新 `catalog.json` 及 npm 包内容清单。CLI 升级应单独审阅版本变化并更新锁文件。

在仓库目录安装维护工具并检查包内容：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm pack --ignore-scripts
npm publish --dry-run --ignore-scripts
```

离线归档包含完整源码、生成的 tgz，以及 `npm ci` 产生的 `node_modules`。保留 `THIRD_PARTY_LICENSES/` 和各依赖自带的许可文件。Git 不跟踪归档文件与 `node_modules`。

正式 npm 发布需使用有 `@zhuzm` scope 权限的账号，核对版本与内容清单：

```bash
npm whoami --registry https://registry.npmjs.org/
npm publish --access public --registry https://registry.npmjs.org/ --ignore-scripts
npm view @zhuzm/yuyin-skills@0.3.0 version --registry https://registry.npmjs.org/
```

登录、双因素认证与发布审批通过 npm 官方流程完成。发布后安装实际发布包验证内容。团队内部分发可使用现有私有 registry。

## 自动发版

`main` 分支收到更新后，GitHub Actions 检查实际分发内容。技能、规则、模板及包内文档发生变化时，自动递增补丁版本、同步安装示例并发布到 npm；预留分类和历史文档的独立修改跳过发布。版本更新提交由仓库的临时 `GITHUB_TOKEN` 写入，不会递归触发发版。

工作流为 `.github/workflows/publish.yml`。npm Trusted Publisher 绑定 GitHub 用户 `coder-zhuzm`、仓库 `yuyin-skills` 和工作流文件 `publish.yml`，并允许直接 `npm publish`。发布使用 OIDC 临时身份，无需配置长期 npm token。

发布任务串行运行，检查失败时停止。候选版本、来源提交及归档摘要保存在 `.github/release-state.json`；失败后重跑同一工作流会恢复该候选版本，已公开的版本会核对内容后补齐标签和 GitHub Release。如果恢复期间已有新的分发内容提交，任务会在完成原候选版本后继续发布这些更新。标签和已有 npm 版本不会被覆盖。

发布成功后验证公开 registry、归档摘要和实际安装内容，再创建 GitHub Release 并附上内容 tgz。较大版本更新可在 Actions 的 **Run workflow** 中填写稳定版本，例如 `0.4.0`；输入必须高于已发布版本，且需先完成已有候选版本。

本地维护检查：

```bash
npm test
npm run verify
```

自动发布仅更新分发来源。目标项目采用新版本时，仍需重新执行 `skills add` 并开启新会话。
