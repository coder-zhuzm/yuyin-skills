# yuyin-skills

面向 Claude Code 与 Codex 的开发技能组合，优先服务 React、Java/Spring，兼顾 Node。`yuyin-dev` 提供中文任务入口；框架、设计与测试能力按需使用精选社区技能。

通用包保存开发方法与技术检查，具体业务、品牌、接口、有效 workaround 和部署环境留在目标项目。不会因为技能更新而要求项目迁移框架或持久层。

## 快速开始

准备好 Node.js **22.20.0 或更高版本**和 Claude Code 或 Codex，在目标项目目录执行：

```bash
npx @zhuzm/yuyin-skills
```

默认将全部 **9 个技能**安装到当前项目，并接入 **Claude Code 和 Codex**。工具及技能内容通过 npm 获取，安装读取包内快照，不需要访问 GitHub。已有同名技能时停止，避免覆盖手动修改。

只安装到 Codex 时增加 `-a codex`，用户级安装增加 `-g`，查看技能增加 `--list`。入口复用固定版本的 Vercel [`skills`](https://github.com/vercel-labs/skills) **1.7.2**，自动关闭遥测。内网 npm 源需能提供本包和工具依赖。

新入口需使用包含该功能的发行版本；v0.3.0–v0.3.3 的 npm 内容包采用[两步安装方式](docs/installation.md#旧内容包的两步安装)。指定技能、固定内容版本及其他安装方式也见[安装指南](docs/installation.md)。

### 调用

安装后开启新会话。Codex 使用 `$yuyin-dev`，Claude Code 使用 `/yuyin-dev`：

```text
$yuyin-dev 给当前 React 页面增加筛选功能，沿用现有组件库。
$yuyin-dev 排查 Spring 接口重复提交的问题，保留现有持久层。
$yuyin-dev 分析 Node 服务的超时原因，先不修改。
```

可以直接调用已安装的上游技能。`yuyin-dev` 负责结合项目事实选择能力，不会因为某个技能缺失而自动安装或升级。

## 技能组合

| 组合 | 用途 | 内容 |
| --- | --- | --- |
| `core` | 分析、功能、修复、审查、交接 | `yuyin-dev` |
| `react` | React 开发、组件设计与 UI | core、Vercel React / composition、Anthropic frontend-design、Web Interface Guidelines 本地快照 |
| `spring` | Java/Spring | core、java-springboot；按现有版本、MyBatis/JPA 与目录结构使用 |
| `node` | Node 后端与 JS/TS 测试 | core、nodejs-backend-patterns、javascript-testing-patterns |
| `web-test` | 浏览器交互验收 | core、webapp-testing；需要 Python Playwright，已有测试工具优先 |

精确技能名和路径见 [catalog.json](catalog.json)。这些组合用于[本地源码辅助安装](docs/installation.md#从源码选择组合)，可以叠加；普通 CLI 按技能名称选择。调用时仅读取当前任务需要的技能。

## 内容与版本

包名称为 **`@zhuzm/yuyin-skills`**，版本 **`0.3.4`**。源码版本字段由发布准备更新；实际发行内容以对应 tag 和 npm 包为准。包包含选定技能、资源、许可、上游锁定记录和 npm 命令入口；运行依赖为 `skills@1.7.2`，Agent 接入由它完成。

新版本准备时获取白名单上游的最新内容，验证后锁定提交和逐文件摘要。同一版本的安装与发布重试使用原快照。已安装项目只在显式更新时采用新内容。

## 仓库结构

```text
skills/development/shared/yuyin-dev/  自有入口与通用方法
skills/upstream/                     精选上游内容与许可快照
upstream/sources.json                 来源、适用技能与审查范围
upstream/lock.json                    提交、文件摘要与适配记录
catalog.json                         技能索引与安装组合
scripts/                             同步、组合安装、验证和发布
bin/yuyin-skills.mjs                 npm 安装入口
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
