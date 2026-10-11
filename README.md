# yuyin-skills

面向 Claude Code 与 Codex 的中文 Agent Skills 集合，提供开发任务工作流、工程规则和项目上下文模板，支持源码安装与 npm 离线分发。

目前提供通用开发技能 **`yuyin-dev`**，覆盖前端、后端与全栈任务。生活、自媒体及专用开发技能分类为预留目录。

## 功能概览

`yuyin-dev` 根据任务意图选择工作流程，以项目源码、现有约束和实际验证结果为依据。

| 任务类型 | 主要输出 |
| --- | --- |
| 功能开发 | 需求边界、实现结果与验收证据 |
| Bug 修复 | 复现条件、原因定位、修复与回归验证 |
| 可行性评估 | 接入点、约束、方案与实施成本 |
| 逻辑梳理 | 入口、调用链、状态变化与代码定位 |
| 性能优化 | 测量基线、瓶颈分析与前后对比 |
| 代码审查 | 问题位置、触发条件、影响与修正建议 |
| 交接与复盘 | 任务状态、验证记录与可执行改进 |

技能支持只读分析与实施任务的区分；项目事实、业务代码和环境配置由目标项目维护。

## 环境要求

- Node.js **22.20.0 或更高版本**。
- 已配置可用的 Claude Code 或 Codex。
- 安装工具为 Vercel [`skills`](https://github.com/vercel-labs/skills) CLI，固定版本 **1.7.2**。

## 快速开始

### 从 GitHub 安装

在目标项目目录执行：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add coder-zhuzm/yuyin-skills \
  -s yuyin-dev -a claude-code -a codex -y
```

默认安装到当前项目。仅使用一个 Agent 时，保留对应的 `-a` 参数；用户级安装添加 `-g`。首次执行需要下载安装工具，内网环境请参阅[离线安装指南](docs/installation.md#离线安装)。

### 从本地源码安装

```bash
git clone https://github.com/coder-zhuzm/yuyin-skills.git
```

在目标项目目录执行，将来源路径替换为实际克隆目录的绝对路径：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add /path/to/yuyin-skills/skills/development/shared \
  -s yuyin-dev -a claude-code -a codex -y
```

### 调用技能

安装后开启新的 Agent 会话，并显式调用：

**Claude Code**

```text
/yuyin-dev 逻辑 梳理项目主流程，列出入口、调用链和重要分支，先不修改代码。
```

**Codex**

```text
$yuyin-dev 修复 定位并修复当前报错，保留现有行为，完成必要的回归验证。
```

更多任务示例与验收方式见[开发工作流](docs/development-workflow.md)。

## npm 分发

内容包名称为 **`@zhuzm/yuyin-skills`**，版本 **`0.3.0`**。包内包含技能、参考资料、规则与模板，无运行时依赖。Agent 接入由 `skills` CLI 完成。

npm 安装方式、离线打包、更新和版本回退见[安装与分发指南](docs/installation.md)。

## 仓库结构

```text
yuyin-skills/
├── skills/
│   ├── development/
│   │   ├── shared/yuyin-dev/   # 通用开发技能及按任务组织的参考资料
│   │   ├── frontend/          # 前端专用技能（预留）
│   │   ├── backend/           # 后端专用技能（预留）
│   │   └── fullstack/         # 全栈专用技能（预留）
│   ├── life/                  # 生活工作流（预留）
│   └── content/               # 自媒体工作流（预留）
├── rules/                     # 通用工程规则
├── templates/                 # 项目、约束、术语与任务模板
├── docs/                      # 安装、开发流程与历史版本说明
├── THIRD_PARTY_LICENSES/       # 第三方许可文本
└── catalog.json               # 技能分类与状态索引
```

每个技能保留一个源码位置，适用领域通过 `catalog.json` 标签描述。规则与模板按项目需要手动采用。

## 文档

- [安装、更新、回退与发布](docs/installation.md)
- [开发工作流与任务示例](docs/development-workflow.md)
- [来源与适配说明](SOURCES.md)
- [验证记录与适用边界](VERIFICATION.md)
- [版本变更记录](CHANGELOG.md)

`docs/history/` 保存旧版工具说明，用于迁移参考；现行安装方式以安装指南为准。

## 许可

本项目的许可标识为 `UNLICENSED`。第三方组件遵循各自的许可条款，详见[来源与适配说明](SOURCES.md)及 `THIRD_PARTY_LICENSES/`。
