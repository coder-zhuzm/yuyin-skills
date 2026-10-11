# CC / Codex 安装与 npm 分发

## 选用的工具和实际边界

采用官方 `skills` CLI 1.7.2（Vercel），通过标准 `SKILL.md` 发现流程；这里只选 `claude-code`、`codex`。不再维护自己的复制、软链接、版本目录、卸载和冲突判断代码。

要求 Node >= 22.20.0。本包没有模型、网关和代理配置；CC/Codex 及公司批准的模型访问须已经可用。以下 shell 示例适用 Linux/macOS；Windows 尚未验证。

`DISABLE_TELEMETRY=1` 关闭上游 CLI 遥测；离线命令只使用本地路径。预览来源用 `add <路径> --list`，查看已装用 `list`。不要把 `--all` 当成默认，它会选择其他工具。

## 外网：源码或已发布 npm 包

有 GitHub 私有仓库权限时，先 clone，再在业务项目里执行：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add /绝对路径/yuyin-skills/skills/development/shared -s yuyin-dev -a claude-code -a codex -y
```

也可直接用私有 Git 来源，但须本机已有 Git 身份，不从 ChatGPT 连接器复制凭证：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add coder-zhuzm/yuyin-skills -s yuyin-dev -a claude-code -a codex -y
```

当前候选 npm 包名 `@coder-zhuzm/yuyin-skills` **未发布，scope 权限未确认**。将来发布后可用 npm 安装内容到独立目录，再交给 `skills`：

```bash
# 仅在包实际发布后执行；候选名称可能按 npm 账号调整
npm install --prefix "$HOME/.local/share/yuyin-skills-package" @coder-zhuzm/yuyin-skills@0.3.0 --ignore-scripts --no-audit --no-fund
DISABLE_TELEMETRY=1 npx skills@1.7.2 add "$HOME/.local/share/yuyin-skills-package/node_modules/@coder-zhuzm/yuyin-skills/skills/development/shared" -s yuyin-dev -a claude-code -a codex -y
```

无需自写一个 `npx yuyin-skills` 包装器。内容更新归 npm，Agent 接入归现成 `skills`。

## 内网：下载 ZIP，一次接入

ZIP 为 `yuyin-skills-v0.3.0-offline.zip`。内含完整源码、内容 tgz、已安装的 `skills` CLI 与全部锁定依赖及许可证。解压后将目录放在稳定位置。在**业务项目**目录执行，替换示例绝对路径：

```bash
PACK="/绝对路径/yuyin-skills-v0.3.0"
node --version
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" add "$PACK/skills/development/shared" -s yuyin-dev -a claude-code -a codex -y
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" list -a claude-code -a codex
```

这条路径直接用 ZIP 内的标准 Skill，不需要 npm registry、空缓存或 Python。如果公司已经提供 `skills@1.7.2`，用公司的安装器即可，无需重复带依赖。首次离线不要使用 `npx`，它可能尝试下载。

想走 npm .tgz 同样可行；包无运行时依赖：

```bash
npm install --prefix "$HOME/.local/share/yuyin-skills-package" "$PACK/coder-zhuzm-yuyin-skills-0.3.0.tgz" --offline --no-update-notifier --ignore-scripts --no-audit --no-fund
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" add "$HOME/.local/share/yuyin-skills-package/node_modules/@coder-zhuzm/yuyin-skills/skills/development/shared" -s yuyin-dev -a claude-code -a codex -y
```

两种内容来源任选其一。默认按项目接入；加 `-g` 可安装到用户级目录。只用 CC 则只传 `-a claude-code`，只用 Codex 则只传 `-a codex`。不支持软链接时加 `--copy`，之后仍按同一方式重新接入更新。

## 软链接和更新的准确含义

项目安装时 `skills` 将源码**复制**到项目 `.agents/skills/yuyin-dev`，CC 的 `.claude/skills/yuyin-dev` 软链接到该副本；Codex 直接读取该标准目录。全局安装使用用户目录。实际位置以 CLI 输出和 `list` 为准。

它不会直接链接你的 ZIP 源码，不会因为改源文件或 npm 升级自动生效。拿到新版本之后，在每个目标项目重新执行同样的 `add`；上游 CLI 可能覆盖同名已安装 Skill，别在安装副本中保存个人修改。先在一个项目试用，再接其他项目，开启新 Agent 会话。项目自己的事实和业务代码不在这个 Skill 目录内。

回退也是从保留的旧源码快照重新 `add`；若只有旧 v0.1/v0.2 ZIP，先取里面的完整 yuyin-dev 目录给新 CLI 安装，不重新启用旧安装器。`skills check/update` 适用于可访问的上游源；离线本地快照明确重新 `add`，不承诺自动从 npm 查询或切换版本。

```bash
DISABLE_TELEMETRY=1 node "$PACK/node_modules/skills/bin/cli.mjs" remove yuyin-dev -a claude-code -a codex -y
```

全局安装的移除也须加 `-g`。同名 Skill 有本机手改时先自行备份，不能把 `-y` 当作冲突保护。

## 项目事实：保留并手动引用

新工具只安装 Skill，不追加/覆盖 `CLAUDE.md`、`AGENTS.md`、`.gitignore`，不生成 `.ai-dev`。已有这些文件直接保留。初次接入按需要复制 `templates/project.md`、`constraints.md`、`glossary.md` 到项目 `.ai-dev`，填写真实入口、版本、启动/检查命令和业务约束；复杂任务才使用 `task.md`。

在项目现有规则入口中补一条“开展任务前读取 `.ai-dev/project.md` 和 `.ai-dev/constraints.md`，存在时读取 glossary，规则冲突按现有项目约定处理”。可参考 `rules/team-rules.md`，无需把通用文件全部导入全局上下文。禁止覆盖已有项目事实。项目是否提交 Skill 副本、入口和本机链接，按团队策略决定；本工具不替你改 Git 跟踪状态。

先在新会话试：

```text
CC: /yuyin-dev 逻辑 梳理当前项目主流程，给入口、调用链、重要分支与代码定位，先不改代码。
Codex: $yuyin-dev 逻辑 梳理当前项目主流程，先不改代码。
```

再做真实 Bug 和小功能，记录误改、返工、重复解释与检查证据。当前未运行公司的宿主或业务系统。

## 从旧自制安装器迁移

已经用旧版接入项目时，先备份本机改动，使用你**现有的旧版**命令解除：`yuyin-dev detach --project "/你的项目"`；v0.1 用 `python3 tools/devpack.py detach --project "/你的项目"`。它会按原规则保留项目事实并移除受管理入口。随后在该项目用上述新 `skills add`。

不要同时让旧 `current` 机制和新 CLI 管理同名入口；不要直接删除整个 `.claude` 或 `.agents`。若旧管理元数据或链接被手改导致 detach 拒绝，先查看旧工具状态和实际路径，再人工迁移；不承诺上游安装器保留手改的同名文件。旧 ZIP 和文档仍留在 Notion，Skill 原内容未改。

## 外网维护、离线制包与 npm 发布

唯一 Skill 源码为 `skills/development/shared/yuyin-dev`。新增专用 Skill 以后放对应分类，仍使用上游安装选择能力，无需改自己的安装算法。升级 CLI 单独审阅并更新 lockfile，不自动追 `latest`。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm pack --ignore-scripts
npm publish --dry-run --ignore-scripts
```

构建离线 ZIP：保留这一份完整源码和生成的 tgz，另带 `npm ci` 产生的 `node_modules`（包含上游包与许可证）。Git 不提交 ZIP、tgz 或 node_modules。使用标准 ZIP 工具；保留 THIRD_PARTY_LICENSES 中的 Vercel skills MIT 许可和各包自带 notice。本仓库没有自制安装/更新脚本。

当前 npm 未登录；正式发布须在有权的 npm 账号下 `npm login`（registry 明确为 npmjs），确认同名 scope 属于自己；否则改 `package.json` 的 name 并重新生成 lockfile、文档与实际 tarball。GitHub 私有仓库保持私有；公共 npm 发布会公开包内列明的 Skill 内容，二者不是同一个权限。

```bash
npm whoami --registry https://registry.npmjs.org/
npm publish --access public --registry https://registry.npmjs.org/ --ignore-scripts
```

不要在聊天里粘贴 token。2FA/发布审批在 npm 自己的登录流程处理。本次只构建/验证，不宣称已注册包名或发布。多人持续更新时沿用公司现有 registry，不另搭更新服务。
