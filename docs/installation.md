# 安装与分发指南

## 环境与版本

需要 Node.js 22.20.0 或更高版本、可用的 Claude Code 或 Codex。安装工具固定为 `skills@1.7.2`，内容包无运行时依赖。维护与组合辅助命令仅在源码仓库提供。

已发布旧版本可能只包含 `yuyin-dev`；使用前以对应版本的 `catalog.json` 为准。尚未发布的改造通过本地源码试用。下列命令适用于 macOS/Linux，Windows 尚未验证。

## 从源码选择组合

在本仓库准备维护工具，列出组合，再为已存在的目标项目安装：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run profiles -- list
npm run profiles -- add --profile core,react,spring \
  --target /path/to/project --agent codex,claude-code
```

`core`、`react`、`spring`、`node`、`web-test` 可以叠加，技能名称去重。`--copy` 选择独立副本。辅助命令不会安装缺失工具，遇到现存同名技能或指向其他位置的目标入口停止，避免误覆盖。

默认 `core + react + spring` 适合主力开发；Node 与 Python Playwright 测试按需使用。安装内容不等于安装运行依赖，Python、浏览器及测试工具由项目环境提供。

## 使用上游 CLI

在目标项目目录执行。来源可以是仓库、本地源码根目录或已安装内容包根目录：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add coder-zhuzm/yuyin-skills --full-depth \
  -s yuyin-dev vercel-react-best-practices vercel-composition-patterns \
     frontend-design web-design-guidelines java-springboot \
  -a claude-code codex -y
```

只使用一个 Agent 时保留对应名称。默认项目级安装，用户级安装增加 `-g`。`--full-depth` 确保发现所有嵌套技能；不用 `--all`，避免把不适用能力全部装入项目。

GitHub 的 `main` 表示当前源码快照；需要固定发行内容时使用已验证的发行 tag URL 或固定版本 npm 包。上游社区的最新变化只在本仓库同步后进入该来源。

## npm 内容包

将已发布内容包安装到独立位置，然后在目标项目使用 `skills` CLI 接入。以下版本号是当前包元数据，正式准备发布时自动更新：

```bash
npm install --prefix "$HOME/.local/share/yuyin-skills-package" \
  @zhuzm/yuyin-skills@0.3.2 --ignore-scripts --no-audit --no-fund

DISABLE_TELEMETRY=1 npx skills@1.7.2 add \
  "$HOME/.local/share/yuyin-skills-package/node_modules/@zhuzm/yuyin-skills" --full-depth \
  -s yuyin-dev vercel-react-best-practices vercel-composition-patterns \
     frontend-design web-design-guidelines java-springboot \
  -a claude-code codex -y
```

精确技能组合见包内 `catalog.json`。源码辅助命令、维护脚本和维护依赖不随内容包分发；使用本地 CLI 或已准备的离线工具。

## 离线安装

离线归档包含源码、真实内容 tgz、已准备的 `skills` CLI 及锁定维护依赖，保留各包自带许可。归档由维护者生成，名称可用 `yuyin-skills-v0.3.2-offline.zip`；自动 GitHub Release 默认附内容 tgz，不自动提供含工具的离线 ZIP。

在目标项目目录执行，将来源替换为实际稳定路径：

```bash
PACK="/path/to/yuyin-skills-v0.3.2"
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" add "$PACK" --full-depth \
  -s yuyin-dev vercel-react-best-practices vercel-composition-patterns \
     frontend-design web-design-guidelines java-springboot \
  -a claude-code codex -y
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" list -a claude-code codex
```

首次离线安装使用归档内 CLI，避免 `npx` 尝试下载。技能内容、UI 审查规则和许可随包保存；模型访问、Python Playwright 与业务第三方仍由目标环境提供。

## 更新、回退与移除

默认 CLI 将内容复制到 `.agents/skills/<name>`，Claude Code 入口链接到共享副本；`--copy` 使用独立副本。实际目录以 CLI 输出为准。安装副本与来源独立，源码更新或 npm 包升级不会自动改变目标项目。

更新前检查来源和手动修改。确认后以同一来源和明确技能名单重新 `skills add`；组合辅助命令故意拒绝已有同名安装。回退使用保留的旧版本快照重新接入，并开启新会话。不要用直接更新社区来源的方式绕过本包锁定版本，否则该项目将使用另一套版本。

完整移除指定技能，示例：

```bash
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" remove yuyin-dev -y
```

移除特定 Agent 可增加 `-a codex` 或 `-a claude-code`，用户级增加 `-g`；共享目录可能因其他 Agent 仍使用而保留。CLI 不修改已有 `AGENTS.md`、`CLAUDE.md` 或项目事实。项目上下文模板与规则只在明确需要时手动采用。

## 维护上游快照

在源码仓库使用：

```bash
npm run upstream:update
npm run upstream:check
npm run upstream:restore
npm test
npm run verify
```

- `update`：读取 `upstream/sources.json` 白名单，解析最新提交，先构造并验证整批内容，再替换快照与锁文件。本地手动修改被拒绝覆盖。
- `check`：仅用本地文件核对来源清单、技能集合、逐文件摘要和已审阅代码，无需联网。
- `restore`：按 `upstream/lock.json` 的完整提交重建，需要可访问来源；不是离线下载命令。已修改的快照不会被强行覆盖。

锁文件记录来源提交、资源摘要、文件模式与适配差异。上游脚本的路径和具体内容摘要均需在白名单中审阅，新脚本或已审阅脚本变化会停止同步。独立许可文件用已审阅全文摘要核对；README 中的许可声明单独核对章节，许可变化同样停止。同步过程不执行上游代码。

业务偏好与项目适配写在自有入口或项目记录，避免手改快照。修改来源清单、脚本白名单或补丁后必须重新 `update`、查看 diff 并验证。

## 自动发布

`main` 的分发内容更新或手动运行发布工作流会进入发布准备。新准备先同步白名单的最新上游、执行验证，将新快照保存为可追溯提交，再沿用现有候选版本、npm OIDC 发布、摘要核对和 GitHub Release 流程。

手动运行选择 `main`，`version` 留空即可自动发布下一个补丁版本，即使分发内容没有变化，也不必手动修改 `package.json`。填写版本时必须高于已发布版本；源码已经设置更高稳定版本时沿用该版本。自动 push 在没有分发内容变化时跳过发布。

未公开候选的恢复只使用原提交归档，不重新获取最新上游。完成恢复后，后续新候选才同步上游。上游无法获取、补丁不再适用、许可或代码审查约束不满足时停止；不会静默用旧内容声称已更新。

手动触发也优先恢复未公开候选；恢复后的第二次检查使用 `prepare --if-changed`，只在后续内容有变化时再发布，避免同一次恢复额外分配空版本。Actions 摘要分别显示跳过原因、准备/恢复的候选版本、校验后的实际发布结果，以及执行失败时的未完成提示。准备候选不代表发布成功。

工作流在 `.github/workflows/publish.yml`。自动同步不创建定时任务；上游独立变化可在需要发版时手动运行工作流发现。目标项目仍需显式接入新版本。

## 旧版迁移

v0.1/v0.2 使用自制安装器。先备份目标项目中的手动修改，使用旧工具解除接入，再执行新的 `skills add`，避免两个安装器管理同名入口。历史命令见 [v0.2 说明](history/v0.2-npm-guide.md)与 [v0.1 说明](history/v0.1-development-workflow.md)。
