# 出处与适配说明

调研日期 2026-10-11。本包为原创中文工作流，吸收下列项目的方法，没有完整复制上游角色、插件或二进制；不承诺与上游版本同步。Star 数和榜单未作可靠性判断依据。

| 来源 | 使用的思想 | 本包适配 |
| --- | --- | --- |
| https://github.com/addyosmani/agent-skills | context-engineering、source-driven-development、debugging-and-error-recovery、code-review-and-quality、constraint-driven-development | 此前提炼为按任务路由的轻量 Skill，当前保持内容不变 |
| https://github.com/mattpocock/skills | grilling/grill-with-docs、domain-modeling、retro | 少量关键问题、按需术语/决策、重复错误落成可执行检查 |
| https://github.com/msitarzewski/agency-agents | Backend Architect、RAG Pipeline Engineer、API Tester、Minimal Change Engineer | 按需领域检查，保留必要调查，不套统一性能阈值 |
| https://github.com/rtk-ai/rtk | 终端输出压缩与保留原始排错方式 | 仅作可选试点，不集成 Hook/二进制 |
| https://github.com/ruvnet/ruflo | 编排、工具与长期协作框架 | 对照选型，当前不安装 |
| https://code.claude.com/docs/en/skills | 项目 .claude/skills、显式调用、软链接支持 | 只链接本 Skill 文件夹，不替换整个 .claude |
| https://code.claude.com/docs/en/memory | CLAUDE.md 与 @ 导入 | 当前只提供项目规则参考，不由安装器修改入口 |
| https://developers.openai.com/codex/skills | 项目 .agents/skills 与显式 Skill 调用 | 本次明确支持 Codex；具体宿主需本机确认 |

上游正式插件有自己的目录依赖、许可与安装方式。本包更新前需再次审阅，不自动将上游新功能或可执行脚本带入公司内网。

## 分发工具（v0.3.0）

- [vercel-labs/skills](https://github.com/vercel-labs/skills)：标准 Skill 发现、CC/Codex 安装、软链接/副本、列出与移除，npm 固定为 skills@1.7.2；Node >=22.20.0。
- [skills CLI 文档](https://www.skills.sh/docs/cli)：本地路径与显式 Agent/Skill 选择。
- npm 官方 [pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) / [publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/) 用于内容分发。

不复制上游安装代码进自己的工具。离线 ZIP 携带 npm 已发布的 skills 及锁定依赖，保留各包自带 LICENSE 文件；第三方许可按包原文，不由本仓库 UNLICENSED 元数据覆盖。精确包版本和 integrity 见 package-lock.json。
