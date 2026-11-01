# yuyin-skills 评审报告（版本 1）

日期：2026-11-01。基线：分支 `coder-zhuzm/rorqual` @ `d165420`，工作区干净。

环境说明：该 worktree 初始未安装依赖，`npm test` / `verify` 因缺少 `yaml` 报错；按仓库文档执行 `npm ci --ignore-scripts` 后，`npm test` 81/81 通过，`verify`、`evals:check`、`upstream:check` 均通过。这不是仓库缺陷。

## 0. 结论

| 维度 | 评价 |
| --- | --- |
| 分发、来源锁定、许可、离线安装 | ✅ 扎实，测试覆盖充分 |
| 防越界（不迁移、不乱装、不谎报） | ✅ 很强，甚至偏重 |
| 准确性（做对事） | ⚠️ 有可执行的规则，但正面指导、输出模板和部分意图有缺口 |
| 效率（少读少问少绕） | ⚠️ 禁令重复多，必读链偏长，上游大文件没有限制读取方式 |
| 行为验证证据 | ❌ 36 格矩阵完成 12 格，仓库内没有真实项目试用记录 |

## 1. 🔴 高优先级（直接影响准确性和效率）

### P1. 禁令密度过高，指令被稀释

- 事实：`yuyin-dev` 全部文件约 22KB，“不”出现 102 次，“授权”出现 17 次。
- 多条规则在 4–6 个文件里各写一遍：
  - “不自动推送或部署”：`SKILL.md`、`feature.md`、`review.md`、`assessment.md`
  - “区分 Mock 与真实联调”：`SKILL.md`、`bug.md`、`feature.md`、`review.md`、`spring.md`
  - “不安装依赖”：`SKILL.md`、`context.md`、`optimization.md`、`stack-skills.md`
- 影响：一次调用至少读 `SKILL.md` + `stack-skills.md` + 一份意图参考，同一条禁令会读到 3 遍以上。
- ⚠️ 推断（未实测）：关键步骤被通用禁令淹没；禁令过多可能让模型过度保守、反复确认。
- 建议：通用边界只在 `SKILL.md` 写一次；references 只保留本意图特有的步骤与输出格式，预计可减重 30–40%。

### P2. 常见意图没有对应参考

`SKILL.md` 的路由表有 8 种意图，以下日常任务没有落点：

- 重构：明确要求“重构 X”时，模型只能在 `optimization` 与 `feature` 之间猜。
- 依赖升级 / 框架迁移：全仓库只写了“不升级”“迁移须有任务依据”，没写被授权升级时怎么做（版本差异、兼容性、回滚、分步验证）。
- 只补测试：没有入口；`feature.md` 的 TDD 规则不适用于给旧代码补测试。

### P3. React 号称优先支持，自有参考却为 0

- 事实：Spring 有自有 `spring.md`（37 行，实务表格加错误示例）；React 完全依赖偏重性能的上游 Vercel 技能，日常状态管理、表单、请求库、组件库沿用没有实务指导。
- 效率风险：`react-best-practices/SKILL.md:153` 指向 3810 行的 `AGENTS.md`；`javascript-testing-patterns/SKILL.md` 本身 541 行。`stack-skills.md` 没有提示“只读相关的单条规则，不读全文”。

### P4. 环境结论没有要求先查证

- 事实（`evals/runs/2026-10-15-smoke.json`）：Claude direct `js-playwright` 运行中，模型未检查就断言“系统没有浏览器”，人工审查标为 `needs-environment-claim-correction`。
- `SKILL.md` 只规定“仅实际运行且结果支持的检查可报告通过”，覆盖正面结论，没覆盖“缺失 / 不可用”这类负面结论。
- 建议：补一句“声称工具、依赖或服务不可用前，先给出实际检查的命令和输出”。

## 2. 🟡 中优先级

| # | 问题 | 依据 | 建议 |
| --- | --- | --- | --- |
| M1 | 同一份路由信息有 4 处副本，易不同步 | `stack-skills.md`、`docs/development-workflow.md`、`catalog.json` scope、README 组合表 | 以 `stack-skills.md` 为准，其余只放链接 |
| M2 | 维护者文字混入模型读取内容 | `domains.md` 首句“本文件保留旧参考路径…”；`web-design-guidelines` 补丁的 Source and Adaptation 段 | 移到 `SOURCES.md` |
| M3 | 交付格式各写各的 | `review.md`“交付四句”；`feature.md`“交付写一个具体前后变化”语义不清；`bug.md`、`assessment.md` 各有一套 | `SKILL.md` 定统一模板，各意图只补差异字段 |
| M4 | description 过宽，隐式调用可能与上游技能抢触发 | ⚠️ 推断：“前后端开发协作入口”几乎匹配所有开发任务 | 先用 implicit 模式实测误触发率再决定是否收窄 |
| M5 | 评测只测越界，不测效率和过度保守 | `evals/manifest.json` 的 forbidden 全是越界项；无轮次、读取文件数、提问次数指标 | 增加“明确授权仍反复确认 / 读取无关参考”的反例 |

## 3. 🔵 评测覆盖缺口（事实）

- 矩阵：完成 12/36，`completeMatrixVerified: false`。
- 自动判定 failed 的 3 次运行，人工复核均为检测脚本误报（Python 栈误判来自技能自带示例；scope 漏了 `src/*.test.mjs`），自动判定可信度需提升。
- 意图覆盖：有案例的是 logic/bug 只读、feature、assessment（缺少技能）、小改动；review、optimization、handoff、context 无案例。
- 技能覆盖：`frontend-design`、`web-design-guidelines` 无案例，`vercel-react-best-practices` 无 direct 调用案例。
- `catalog.json` 中 9 个技能均为 `ready-for-project-trial`，但仓库无真实项目试用记录。

## 4. ⚪ 观察（不要求改）

- 维护脚本与测试约 2880 行，自有技能内容约 237 行，治理成本远高于内容本身；若目标是提升使用效果，后续投入应向技能内容与真实试用倾斜。
- 上游补丁机制良好：8 个上游技能中 7 个注入 `Project Compatibility` 段，`web-design-guidelines` 改为读取本地快照，可追溯、可重建。✅

## 5. ❓ 待确认

1. 主力宿主是 Claude Code 还是 Codex？决定 M4 优先级。
2. 实际痛点更常是“太保守 / 慢 / 反复问”，还是“越界乱改”？若是前者，P1 排第一。
3. P2（重构、升级、补测试）与 P3（React 实务）是否补？建议从最常用的 1–2 个开始。
