# yuyin-skills

余音的个人 Agent Skills：开发、生活与自媒体工作流，支持 npm 离线分发。

当前只提供一个开发通用 Skill **yuyin-dev**，适用前端、后端和全栈。生活、自媒体和专用领域 Skill 仅为预留。安装对象只支持本仓库验证过的 **Claude Code（CC）与 Codex**。

**使用 Vercel 的 `skills` CLI 1.7.2，不维护自己的安装器。** npm 包只分发 Skill、参考资料和项目模板，不包含自制 CLI、Hook 或编排框架。既有 Skill 内容没有修改，旧 v0.1/v0.2 附件保留为历史。

## 快速接入

Node >= 22.20.0。先将这个私有仓库克隆到本机，并记下绝对路径。在待开发项目中执行：

```bash
# /path/to/yuyin-skills 替换成真实克隆路径
DISABLE_TELEMETRY=1 npx skills@1.7.2 add /path/to/yuyin-skills/skills/development/shared -s yuyin-dev -a claude-code -a codex -y
```

此命令需要首次获取 CLI，纯内网使用 [离线安装指南](docs/installation.md)。只用一个工具就只保留对应的 `-a` 参数。不用 `--all`，避免安装到其他 Agent。默认按项目安装，需要全局时加 `-g`。

Claude Code 显式调用 `/yuyin-dev`，Codex 用 `$yuyin-dev`。先试只读梳理已有逻辑，再试真实 Bug/小功能。检查文件成功不等于宿主运行时识别成功。

## 分类与唯一源码

| 路径 | 内容 | 状态 |
| --- | --- | --- |
| `skills/development/shared/yuyin-dev/` | 新功能、Bug、可行性、逻辑、优化、审查、交接/复盘 | 已有；前后端共用一份 |
| `skills/development/frontend/` | UI、交互、浏览器验收 | 预留 |
| `skills/development/backend/` | API、权限、数据、事务 | 预留 |
| `skills/development/fullstack/` | 跨页面、接口、数据的闭环 | 预留 |
| `skills/life/`、`skills/content/` | 生活、自媒体 | 预留，暂不实施 |
| `rules/`、`templates/` | 通用规则与项目事实模板 | 手动按项目采用，不自动改入口 |

## npm 分发状态

本地包版本 v0.3.0，候选包名 `@coder-zhuzm/yuyin-skills`，**未发布到 npm**。GitHub 用户名不代表已拥有同名 npm scope，发布前须登录并确认权限。这个名字不能在发布前用于在线安装。

```bash
# 在源码目录：仅安装现成维护工具，然后打内容包
npm ci --ignore-scripts --no-audit --no-fund
npm pack --ignore-scripts
npm publish --dry-run --ignore-scripts
```

npm 包不带运行时依赖；`skills` 是锁定版本的开发依赖。内网 ZIP 另附已安装的上游 CLI 及其依赖，内网运行不需要 `npx` 下载。更新/回退是在各项目中重新执行 `skills add`，没有旧版自制 `current` 切换机制。

- [安装、更新、回退、迁移与发布](docs/installation.md)
- [日常开发流程与上游选型](docs/development-workflow.md)
- [来源与适配](SOURCES.md)
- [实际验证及边界](VERIFICATION.md)
- [Notion 手册](https://app.notion.com/p/3f627a782ef68164bda9f65114cdf307)

`docs/history/` 保存之前的工具文档，只用于理解旧安装，不是当前安装指引。公司代码、日志、账号和项目事实应留在公司项目，不进入通用分发包。
