# yuyin-skills 优化方案

状态：P0 + P1 的实现与机械验证已补齐，双端样例验收及限制另行记录；完整行为矩阵仍待验证。P2 后置。

## 目标与基线

基于 2026-10-15 的仓库审查和实际联网调研，保留“中文入口 + 按需参考 + 精选上游 + 项目事实”的结构，优先改善独立调用适配、真实任务验收和 Spring 实务参考。

实施前基线：`main`，提交 `1b5516e`，工作区干净。仓库优先服务 React、Java/Spring，兼顾 Node，接入 Claude Code 和 Codex。已有 React 18/Vite/MUI、Java 11/Spring Boot 2.7/MyBatis 的合成场景，不将这些版本固化为所有项目的要求。

当前应保留：

- 36 行 `yuyin-dev` 入口及按意图加载的参考，不拆成大量重复工作流。
- 业务、接口、品牌、部署环境及有效 workaround 保留在目标项目。
- 8 个精选上游技能，以及来源白名单、完整提交、逐文件摘要、许可和补丁记录。
- 内容快照、离线安装、候选恢复与现有自动发布机制。

相关基线：[技能入口](../../skills/development/shared/yuyin-dev/SKILL.md)、[来源](../../SOURCES.md)、[目录](../../catalog.json)、[历史验证](../../VERIFICATION.md)。历史测试记录不代表本轮重新验证通过。

## 社区调研与取舍

调研实际读取了 GitHub 文件及官方文档；未使用 stars 作为效果证据。Matt Pocock 的研究版本固定为 `49dd158d1076134a641b33efb035946536778336`（2026-10-09）。

| 来源 | 适合吸收的做法 | 适配与取舍 |
| --- | --- | --- |
| [Matt writing-for-agents](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/writing-for-agents/SKILL.md) | description 负责发现；正文保留共用步骤；分支参考按需读取；明确结束条件 | 精修现有入口与 references，不增加重复规则 |
| [Matt tdd](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/tdd/SKILL.md) | 公共接口行为测试、独立预期值、一个行为一个循环 | 补入现有开发方法，不默认安装第二套 TDD 工作流 |
| [Matt codebase-design](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/codebase-design/SKILL.md) | 检查抽象是否通过小接口收敛复杂度 | 不照搬作者对技术术语与目录的个人要求 |
| [Matt code-review](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/code-review/SKILL.md) | 分别核对仓库规范与原始需求 | 覆盖工作区差异，不能仅审分支提交 |
| [Matt grilling](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/productivity/grilling/SKILL.md) | 先查事实，再问关键决策，给出推荐及取舍 | 普通修复不默认进入长时间访谈 |
| [Addy code-review-and-quality](https://github.com/addyosmani/agent-skills/blob/main/skills/code-review-and-quality/SKILL.md) | 需求、测试、正确性与架构证据 | 继续作为方法来源，不引入整套生命周期命令 |
| [Superpowers systematic-debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md) / [writing-skills](https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md) | 复现、单一假设、回归；技能本身也接受行为验收 | 现有 bug/review 已覆盖主要流程，避免整包叠加 |
| [Antfu](https://github.com/antfu/skills/blob/main/AGENTS.md) / [Vitest](https://github.com/antfu/skills/blob/main/skills/vitest/SKILL.md) | 区分手写与生成内容、记录来源、专题索引 | 不继承 Vue、pnpm、个人 lint 等偏好；明确缺口后再选装 |
| [ECC Spring TDD](https://github.com/affaan-m/ECC/blob/main/skills/springboot-tdd/SKILL.md) | 按 Service、Web、数据库和集成测试层次组织 | 不强推 JPA、Testcontainers 或统一覆盖率目标 |

Matt 的 [to-spec](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/to-spec/SKILL.md) 包含发布 Issue，[implement](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/skills/engineering/implement/SKILL.md) 包含提交要求，部分工作流写文档或调用子代理。只吸收适用的方法，不随内容引入额外操作授权。

原有来源继续保留：Vercel React/composition 按框架与版本筛选；frontend-design 用于明确设计任务；Python Playwright 为可选方案；GitHub Spring 作为基础参考；wshobson Node/JS testing 按需读取。

## P0-1：独立调用的适用边界

问题：README 允许直接调用专业技能，但“保留 MyBatis、现有测试工具优先”等条件主要位于 `yuyin-dev` 路由。上游 Spring 直接建议 JPA，webapp-testing 直接要求 Python Playwright。静态证据说明覆盖范围有缺口，尚不能断言模型必然误迁移。

实施：复用现有 `upstream/sources.json` 的显式补丁机制，在必要的独立入口补最短适用条件。识别当前版本、架构和测试工具；示例不构成迁移要求；工具缺失说明限制。所有变化可重建、可追溯，不手工改快照后直接重算摘要。

验收：经中文入口、自然语言选择或直接调用专业技能，都不无依据升级框架、替换持久层、引入第二套测试工具或扩大范围。

## P0-2：真实源码行为案例

现有安装测试覆盖实际 CLI、资源一致、网络阻断和项目文件保护。历史行为验收是没有真实业务源码的指令演练，需要补微型真实源码案例。

| 案例 | 可观察验收 |
| --- | --- |
| Node 超时只读分析 | 工作区不变；诊断与调用链、配置一致 |
| React 18 局部功能 | 行为检查通过；保留组件库，不使用不适用的 Next/React API |
| Spring/MyBatis 修复 | 保留持久层；失败案例与修复证据对应 |
| 已有 JS Playwright | 继续使用已有工具，区分源码判断、测试与真实页面验收 |
| 缺少技能或运行依赖 | 不自动安装，不宣称未执行验证通过 |
| 小 bug 或文案 | 完成局部修改，不触发全站重构、额外文档或长访谈 |

每例保存输入、预期行为、禁止行为、验证方式和实际运行结果。两种宿主分别在新会话中验收，覆盖显式、隐式及关键独立入口。机械检查与需要人工核对的 trace 分开；进程退出 0 不等于技能效果通过。

先用小规模本地工具，不建设大型评测平台。真实模型运行取决于当前客户端、认证、网络与沙箱能力；受阻时保留证据，不用 mock 结果替代。

参考：[OpenAI Skill Evals](https://developers.openai.com/blog/eval-skills)。

## P1-1：Spring 实务与已有方法补强

在自有 references 中增加按项目证据启用的 Spring 参考，覆盖：

- Controller–Service–Mapper/Repository 的实际链路与现有约定。
- 事务、异常、幂等、重试及失败路径。
- DTO、分页与返回值兼容性。
- Service、Web、数据库与真实联调的验证层次。

提供少量错误/正确例子与验证方式，不固化框架版本、数据访问方式或项目身份。

在功能、评估和审查参考中补范围外事项、测试决策、独立预期值与原始需求覆盖。只在重复出现独立调用需求后才考虑拆为新 skill。

## P1-2：上游行为变化验收

现有发布准备刷新上游并运行测试与 verify。文件锁定证明可追溯，不直接证明新指令适合用户。

实施：更新时记录触发范围、工作流、工具依赖、外部操作等指令与资源的变化，关联受影响的案例。保留原有候选恢复规则；未完成真实行为验收明确标记，不从静态检查推定通过。

验收：可以回答本次变更涉及什么、哪些案例受影响、实际验收证据是什么、哪些范围仍未验证。机械检查运行在现有验证链路，真实模型调用保持显式且可复现。

## Claude Code / Codex 兼容

共享正文与资源，平台元数据只做必要适配。不在通用正文假定固定工具、变量、子代理语法或额外权限。description 写清任务和边界，通过双端案例验证。

参考：[Claude Code skills](https://code.claude.com/docs/en/skills)、[Codex skills](https://learn.chatgpt.com/docs/build-skills)、[Agent Skills 规范](https://agentskills.io/specification)、[Matt 双端调用约定](https://github.com/mattpocock/skills/blob/49dd158d1076134a641b33efb035946536778336/.agents/invocation.md)。

## P2：后置

后续可让公开 npm 入口直接使用 catalog 中已有的 react/spring/node 组合，并共享安装检查逻辑。保留当前全量安装默认体验。本轮不重写安装器、不迁移分发方案、不扩展其他 Agent。

## 实施步骤与进度

- [x] 获得 P0 + P1 实施授权，保存方案，复查工作区基线。
- [x] 建立六类微型源码案例、双端运行入口与机械检查。
- [x] 通过声明补丁补齐独立入口适用条件并重建锁定快照。
- [x] 增加 Spring 参考，精修功能、评估和审查。
- [x] 上游变化关联受影响案例，集成更新验收。
- [x] 运行相关测试、分发校验与可行的双端任务验收，审查 diff 并记录限制。

六类案例已分别在 Codex 与 Claude Code 新会话运行，覆盖显式、自然语言和关键专业入口，共十二个代表性组合。它们不等于完整的 36 项宿主/案例/调用矩阵。生成的上游报告仍保留 pending，实际运行与人工复核证据单独保存；浏览器执行、Java/MyBatis/目标数据库联调、frontend-design 独立行为尚未验证。Claude Code 沿用本机既有模型配置，不代表 Anthropic 模型单独测评。

独立审查发现并修复了模型产物自动执行越过客户端沙箱，以及后续更新丢失未覆盖范围的问题；新增回归覆盖只改案例映射、报告替换失败回滚、执行环境隔离与工具误报。真实行为还发现一次未经检查就声称系统浏览器缺失的表述，保留原始失败证据并针对入口补充约束，复测结果见验证记录。

维护入口见 [evals/README.md](../../evals/README.md)，本轮实际结果与限制见 [VERIFICATION.md](../../VERIFICATION.md)。

改动范围：现有入口参考、上游来源/补丁/锁、行为案例与验证支持，以及直接相关的来源/使用/验证说明。计划与评测维护材料不进入技能内容包。

用户本次授权保存方案并实施；不包含提交、推送或发布。完成后报告实际变更、证据与未验证范围，不把工具退出码、模拟测试或历史记录等同于当前真实效果。
