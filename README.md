# yuyin-skills

面向 Claude Code 与 Codex 的开发技能组合，优先服务 React、Java/Spring，兼顾 Node。`yuyin-dev` 提供中文任务入口；框架、设计与测试能力按需使用精选社区技能。

通用包保存开发方法与技术检查，具体业务、品牌、接口、有效 workaround 和部署环境留在目标项目。不会因为技能更新而要求项目迁移框架或持久层。

## 技能组合

| 组合 | 用途 | 内容 |
| --- | --- | --- |
| `core` | 分析、功能、修复、审查、交接 | `yuyin-dev` |
| `react` | React 开发、组件设计与 UI | core、Vercel React / composition、Anthropic frontend-design、Web Interface Guidelines 本地快照 |
| `spring` | Java/Spring | core、java-springboot；按现有版本、MyBatis/JPA 与目录结构使用 |
| `node` | Node 后端与 JS/TS 测试 | core、nodejs-backend-patterns、javascript-testing-patterns |
| `web-test` | 浏览器交互验收 | core、webapp-testing；需要 Python Playwright，已有测试工具优先 |

精确技能名和路径见 [catalog.json](catalog.json)。安装组合可叠加，调用时仅读取当前任务需要的技能。

## 快速开始

需要 Node.js **22.20.0 或更高版本**，以及可用的 Claude Code 或 Codex。安装工具固定为 Vercel [`skills`](https://github.com/vercel-labs/skills) **1.7.2**。

使用前核对来源版本的 `catalog.json`；旧发行版可能仅包含 `yuyin-dev`。当前源码可按下一节从本地试用。

在目标项目目录安装主要的 React + Spring 组合：

```bash
DISABLE_TELEMETRY=1 npx skills@1.7.2 add coder-zhuzm/yuyin-skills --full-depth \
  -s yuyin-dev vercel-react-best-practices vercel-composition-patterns \
     frontend-design web-design-guidelines java-springboot \
  -a claude-code codex -y
```

只使用一个 Agent 时保留对应名称。默认项目级安装，用户级安装增加 `-g`。同名内容可能被 CLI 更新，已有安装应先核对来源与手动改动。

### 从本地源码选择组合

在本仓库安装维护依赖后执行。目标项目必须已存在，路径替换为实际绝对路径：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run profiles -- list
npm run profiles -- add --profile core,react,spring \
  --target /path/to/project --agent codex,claude-code
```

该辅助命令只复用本地 `skills` CLI，不联网安装工具；遇到已有同名技能停止，避免误覆盖。源码安装、npm 内容包与离线使用的完整说明见[安装指南](docs/installation.md)。

### 调用

安装后开启新会话。Codex 使用 `$yuyin-dev`，Claude Code 使用 `/yuyin-dev`：

```text
$yuyin-dev 给当前 React 页面增加筛选功能，沿用现有组件库。
$yuyin-dev 排查 Spring 接口重复提交的问题，保留现有持久层。
$yuyin-dev 分析 Node 服务的超时原因，先不修改。
```

可以直接调用已安装的上游技能。`yuyin-dev` 负责结合项目事实选择能力，不会因为某个技能缺失而自动安装或升级。

## 内容与版本

内容包名称为 **`@zhuzm/yuyin-skills`**，版本 **`0.3.1`**。源码版本字段由发布准备更新；实际发行内容以对应 tag 和 npm 包为准。包无运行时依赖，包含选定技能、资源、许可与上游锁定记录；Agent 接入仍由 `skills` CLI 完成。

新版本准备时获取白名单上游的最新内容，验证后锁定提交和逐文件摘要。同一版本的安装与发布重试使用原快照。已安装项目只在显式更新时采用新内容。

## 仓库结构

```text
skills/development/shared/yuyin-dev/  自有入口与通用方法
skills/upstream/                     精选上游内容与许可快照
upstream/sources.json                 来源、适用技能与审查范围
upstream/lock.json                    提交、文件摘要与适配记录
catalog.json                         技能索引与安装组合
scripts/                             同步、组合安装、验证和发布
rules/、templates/                   按项目需要手动采用
```

## 维护与来源

```bash
npm run upstream:update    # 获取白名单来源最新内容，失败不发布
npm run upstream:check     # 离线核对快照
npm run upstream:restore   # 按锁定提交重建，需要能访问来源
npm test
npm run verify
```

- [安装、更新、离线与发布](docs/installation.md)
- [开发工作流与适用边界](docs/development-workflow.md)
- [来源、许可与适配](SOURCES.md)
- [验证记录与未覆盖范围](VERIFICATION.md)
- [变更记录](CHANGELOG.md)

自有内容保持 `UNLICENSED`；第三方内容保留各自许可。不得直接修改上游快照来保存个人偏好，适配条件放在自有入口，业务事实放在目标项目。
