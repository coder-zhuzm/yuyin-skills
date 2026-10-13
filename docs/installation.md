# 安装与分发指南

## 环境与版本

需要 Node.js 22.20.0 或更高版本、可用的 Claude Code 或 Codex。npm 命令入口复用运行依赖 `skills@1.7.2`，从本包读取技能内容。维护与组合辅助命令仅在源码仓库提供。

当前提供 9 个技能，精确名称见 [catalog.json](../catalog.json)。旧发行版的内容以对应版本的索引为准。下列命令适用于 macOS/Linux，Windows 尚未验证。

## 快速安装

在目标项目目录执行：

```bash
npx @zhuzm/yuyin-skills
```

默认将全部 9 个技能安装到当前项目，同时接入 Claude Code 和 Codex，无需选择技能或工具。npm 首次下载包时可能询问是否继续。

本包和工具依赖从已配置的 npm 源获取，技能内容及 UI 审查规则随包提供，安装不从 GitHub 拉取。内网 npm 源需能提供 `@zhuzm/yuyin-skills`、`skills` 及其依赖。这个方式需要访问 npm，不是首次完全离线安装。

使用包含命令入口的发行版本。v0.3.0–v0.3.3 的 npm 内容包不含命令入口，使用下文的两步安装。

### 可选参数

- 指定开发工具：增加 `-a claude-code codex`，只用其中一个时只填写对应名称。
- 指定技能：增加 `-s <技能名...>`，例如 `-s yuyin-dev java-springboot`。
- 用户级安装：增加 `-g`，默认范围为当前项目。
- 独立副本：增加 `--copy`，默认 Claude Code 入口链接到共享副本。
- 查看技能：增加 `--list`，仅读取包内索引，不安装技能。
- 查看帮助或包版本：增加 `--help` 或 `--version`。

工具版本由本包固定为 `skills@1.7.2`。需要固定技能内容版本时，在包名后增加 `@版本号`，选择包含命令入口的发行版。关闭遥测和技能免交互安装由入口自动处理，不必增加参数。

例如，仅为 Codex 安装通用入口和 Spring 技能：

```bash
npx @zhuzm/yuyin-skills -a codex -s yuyin-dev java-springboot
```

入口只支持 Claude Code 和 Codex，拒绝额外来源和未知参数。安装前检查同名内容和目标目录的符号链接；发生冲突时停止，不自动覆盖。安装后检查 CLI 的结构化结果及每个技能的实际资源，失败时返回非零退出码，可能已有部分安装，应先检查目标目录再重试。

### 从 GitHub 安装

可以访问 GitHub 时，也可使用上游 CLI，按提示选择技能、工具和安装位置：

```bash
npx skills add coder-zhuzm/yuyin-skills
```

这条命令从 npm 获取 CLI，再从 GitHub 获取仓库；仅能访问 npm 时不能使用它。当前仓库无需 `--full-depth` 就能发现全部技能。上游 CLI 的 `--all` 同时选择所有技能和所有支持的 Agent，并启用免交互，与本包入口的默认行为不同。

GitHub 的 `main` 表示当前源码快照；需要固定发行内容时使用发行 tag URL 或固定版本 npm 包。上游社区的最新变化只在本仓库同步后进入该来源。

## 从源码选择组合

在本仓库准备维护工具，列出组合，再为已存在的目标项目安装：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run profiles -- list
npm run profiles -- add --profile core,react,spring \
  --target /path/to/project --agent codex,claude-code
```

`core`、`react`、`spring`、`node`、`web-test` 可以叠加，技能名称去重。`--copy` 选择独立副本。辅助命令不会安装缺失工具，遇到现存同名技能或指向其他位置的目标入口停止，避免误覆盖。

示例中的 `core + react + spring` 适合 React 与 Java/Spring 开发；组合需通过 `--profile` 明确选择，普通 CLI 不识别这些组合名。Node 与 Python Playwright 测试按需使用。安装内容不等于安装运行依赖，Python、浏览器及测试工具由项目环境提供。

## npm 内容包

### 旧内容包的两步安装

v0.3.0–v0.3.3 的 npm 内容包没有命令入口。在目标项目目录执行以下两步也可避开 GitHub；新版仍可使用此方式。以下内容版本号与当前包元数据一致，发布准备时自动更新：

```bash
npm install --prefix ~/.local/share/yuyin-skills @zhuzm/yuyin-skills@0.3.4
npx skills add ~/.local/share/yuyin-skills/node_modules/@zhuzm/yuyin-skills
```

第一步从 npm 下载内容包；第二步由上游 CLI 读取本地包，按提示接入。已有同名内容可能被上游 CLI 更新，应先检查手动修改。精确技能组合见包内 `catalog.json`。源码辅助命令和维护脚本不随 npm 包分发。

## 离线安装

离线归档包含源码、真实内容 tgz、已准备的 `skills` CLI 及锁定维护依赖，保留各包自带许可。归档由维护者生成，名称可用 `yuyin-skills-v0.3.4-offline.zip`；自动 GitHub Release 默认附内容 tgz，不自动提供含工具的离线 ZIP。

在目标项目目录执行，将来源替换为实际稳定路径：

```bash
PACK="/path/to/yuyin-skills-v0.3.4"
node "$PACK/bin/yuyin-skills.mjs"
node "$PACK/bin/yuyin-skills.mjs" --list
```

首次离线安装使用归档内入口和已准备的运行依赖，避免 `npx` 尝试下载。旧归档没有新入口时，使用 `DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" add "$PACK"`。技能内容、UI 审查规则和许可随包保存；模型访问、Python Playwright 与业务第三方仍由目标环境提供。

## 更新、回退与移除

默认 CLI 将内容复制到 `.agents/skills/<name>`，Claude Code 入口链接到共享副本；`--copy` 使用独立副本。实际目录以 CLI 输出为准。安装副本与来源独立，源码更新或 npm 包升级不会自动改变目标项目。

更新前检查来源和手动修改。npm 命令入口和组合辅助命令都拒绝已有同名安装。需要更新或回退时，先按两步安装方式取得目标版本的本地内容包，再以明确技能名单运行 `skills add`，最后开启新会话；上游 CLI 可能覆盖已有同名内容。不要用直接更新社区来源的方式绕过本包锁定版本，否则该项目将使用另一套版本。

完整移除指定技能，示例：

```bash
npx skills remove yuyin-dev
```

离线时将 `npx skills` 换成 `DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs"`。移除特定 Agent 可增加 `-a codex` 或 `-a claude-code`，用户级增加 `-g`；共享目录可能因其他 Agent 仍使用而保留。CLI 不修改已有 `AGENTS.md`、`CLAUDE.md` 或项目事实。项目上下文模板与规则只在明确需要时手动采用。

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
