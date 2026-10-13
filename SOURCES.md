# 出处、许可与适配

本仓库维护自有中文开发入口与精选社区内容。过往项目仅用于发现通用检查点，具体业务、品牌、内部接口与环境不随包传播。

## 当前上游来源

| 来源 | 选定内容 | 许可与处理 |
| --- | --- | --- |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | React 性能、组件组合、UI 审查入口 | 上游 README 声明 MIT，React skills 元数据也标明 MIT；当前没有独立 LICENSE，保留原 README 为各技能的 `LICENSE-UPSTREAM.md`，不借用安装工具的许可证 |
| [anthropics/skills](https://github.com/anthropics/skills) | frontend-design、webapp-testing | 两个选定目录各有 Apache-2.0 `LICENSE.txt`，保留原文；不对整个仓库采用统一许可假设 |
| [github/awesome-copilot](https://github.com/github/awesome-copilot) | java-springboot | MIT，保留原 LICENSE；社区建议不代表 Spring 官方标准 |
| [wshobson/agents](https://github.com/wshobson/agents) | nodejs-backend-patterns、javascript-testing-patterns | MIT，保留原 LICENSE；只复制所选技能及其资源，不安装完整插件体系 |
| [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) | UI 审查规则 command.md | MIT，规则及 LICENSE 随 UI skill 保存，独立锁定源提交 |

精确仓库、路径、许可文件与代码审阅范围见 [upstream/sources.json](upstream/sources.json)。实际获取的完整提交、逐文件 SHA-256、许可审阅摘要和补丁摘要见 [upstream/lock.json](upstream/lock.json)。这些文件是本包维护数据，不是 Agent Skills 标准自带的依赖解析功能。

## 适配与完整性

优先保留上游原文、引用资源与技能名。所有适配在来源清单和锁记录中显式列出：

- `web-design-guidelines` 原版运行时抓取 `main/command.md`；本包改为读取随包的本地规则，固定发行内容并支持离线审查。
- Vercel 汇编 `AGENTS.md` 中指向根目录的单条规则链接，必要时修正到实际 `rules/` 目录；不改变规则正文。
- 仓库根许可或声明复制到每个选定 skill，确保单独安装时保留来源声明。

React/Next.js、React 18/19、Spring 版本、MyBatis/JPA 及测试框架以目标项目实际依赖为准。中文入口补充适用条件，不把上游示例变成升级或迁移指令。`webapp-testing` 中示例地址和输出路径属于上游样例，实际运行须按目标环境选择；其服务辅助脚本只在用途、命令和运行依赖已核实后使用。

Vercel CLI 安装会排除技能里的 `metadata.json` 和缓存目录，这是上游安装行为；发行快照仍保存完整源目录，行为指令、规则、示例与许可必须安装完整。

## 自有流程的方法来源

自有中文入口曾参考 [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) 的源码驱动与上下文方法，以及 [mattpocock/skills](https://github.com/mattpocock/skills) 的需求澄清与复盘方法。此类方法参考不视为依赖，也不承诺同步其完整工作流。

本项目自有内容保持 `UNLICENSED`。第三方内容遵循各自许可，包元数据不能覆盖上游条款。保留上游声明、许可与适配记录；新增来源需核对实际选定文件及附带资源。

## 分发工具

[Vercel skills CLI](https://github.com/vercel-labs/skills) 固定为 1.7.2，负责技能发现与 CC/Codex 安装；其原许可保存在 `THIRD_PARTY_LICENSES/VercelSkills-LICENSE.txt`。维护依赖的精确版本与 integrity 见 `package-lock.json`。

[skills-npm](https://github.com/antfu/skills-npm) 和 [antfu/skills-pack](https://github.com/antfu/skills-pack) 用于对照组合分发机制，本包当前不依赖它们。为保留完整内容包与离线安装，采用发版同步、固定快照的方式。
