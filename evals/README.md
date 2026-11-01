# 技能行为验收

在源码仓库运行；本目录和维护脚本不进入 npm 技能内容包。当前有 16 个案例、8 个 fixture，既含故意保留的缺陷，也含需保持的正确契约；不直接修改素材来伪造模型验收结果。

## 机械检查

```bash
npm run evals:check
npm test
npm run verify
```

`evals:check` 检查案例定义、源码和预期缺陷是否一致。React 筛选及金额格式通过独立输入/输出检查；Spring 的静态 SELECT 在内存 SQLite 样例数据上执行，不能证明 Java 编译、MyBatis 映射、事务或目标数据库行为。HTML/断言内容检查不代表浏览器交互通过。已有 JS Playwright 未安装时记录 blocked，不自动安装工具或浏览器。

模型修改后的 JavaScript 模块和浏览器测试不会由父验收器自动执行，动态检查默认 blocked；客户端沙箱不会自动延伸到验收器进程。未修改的已知源码检查固定在可信 fixture 中执行。只有人工检查完整源码、导入与副作用后，才可在适当环境中通过 API 的 `allowReviewedExecution: true` 显式验证；该开关不对 CLI run 开放。保留自动结果，将这些后续检查单独写为 `reviewedChecks`，注明审查依据。检查子进程不继承认证环境变量。

## 真实宿主运行

每次显式启动一个新会话，只在全新隔离项目中操作。`--out` 必须是源码仓库外尚不存在的目录。客户端、登录状态和所用模型沿用当前环境；不会读取或导出凭证，也不绕过沙箱和审批。只有下面的 `run` 命令会调用模型，普通测试和发布验证不会调用。

```bash
node scripts/evals.mjs run --host codex --mode explicit --case node-readonly --out /tmp/yuyin-eval-codex-node-1
node scripts/evals.mjs run --host claude --mode direct --case spring-mybatis --out /tmp/yuyin-eval-claude-spring-1
```

宿主为 `codex` 或 `claude`；调用方式为 `explicit`（中文入口）、`implicit`（仅自然语言）或 `direct`（专业技能入口）。案例 ID 见 [manifest.json](manifest.json)。可选 `--executable PATH` 指定已安装客户端；`--timeout-ms` 为 1000–600000，默认 180000。没有安装或登录客户端时保留 incomplete 证据，不自动安装或切换账号。

对照试验增加 `--skill-group none|core|all`，分别只改变项目内安装的技能集合；原有按案例安装使用默认值 `case`。`none` 组只允许 implicit，避免显式请求不存在的技能。用户级配置和技能仍可能可见，须核查 trace，不能将该组称为完全没有任何技能的环境。`--prompt-kind natural` 使用自然短请求；`small-copy` 还支持 `negative`，只解释源码并检查没有修改文件。各组保持相同宿主、模型、提示及验收条件并重复运行；可用 `--model MODEL` 固定模型，也保存 trace 中实际报告的模型身份。

`result.json` 增加耗时、结构化工具调用、Read 文件、Skill 调用、宿主返回的用量与费用。shell 内部读取量不作推算；澄清和返工次数留待人工审阅，不将缺失记为零。比较应同时报告正确性、越界、无关加载、澄清、返工与成本，单个小任务的结果不代表整体增益。

Codex 使用 read-only/workspace-write 沙箱和 ephemeral 会话。Claude 保留用户设置以沿用现有认证，使用 dontAsk 及 Read/Glob/Grep/Skill；修改案例额外允许 Edit/Write，禁用 MCP 配置、Chrome 集成与命令执行工具。按[官方 hooks 文档](https://code.claude.com/docs/en/hooks#disable-or-remove-hooks)，仅本次调用设置 `disableAllHooks`，不改用户配置；受管理的 hooks 仍遵循管理策略。本轮 Claude 检查由外部验收工具运行，不能据此断言模型自行运行了测试；需要验证其命令选择时，应另在具备适当权限的环境中验收。两端均保存实际复制的技能文件摘要，用户级客户端行为仍需结合 trace 核实。

每次输出：

- `prompt.txt`、`before/`、`project/`：实际输入、实施前后项目与技能。
- `baseline.json`、`changes.json`、`diff.patch`：文件摘要、变化范围与可读差异。
- `trace.jsonl`、`stderr.log`：客户端执行记录和错误；可能包含项目内容，分享前检查。
- `result.json`：客户端版本、调用方式、结束状态、逐项机械结果、预期/禁止行为，以及待完成的人工审查。

进程退出 0 之外，还必须有宿主的成功结束事件。机械失败记 failed；依赖缺失记 blocked；无成功结束、启动失败或超时记 incomplete。机械检查通过只会记 needs-trace-review。

## 新增意图与专项案例

`refactor-local` 检查去重前后输出与输入不变；`tests-only` 仅允许测试文件变化，人工审阅后再运行生成测试，并要求它们识别错误总额和丢失 VIP 折扣两个受控变异。测试首次通过适用于已有正确行为，不要求为了制造红灯修改生产代码。

`upgrade-local` 使用仓库内虚构 SDK 的 v1/v2，检查指定依赖声明、适配器和整数分契约。它不下载依赖、不证明 npm 解析或真实供应商兼容。review、optimization、context、handoff 各有只读案例；设计、本地 UI 审查与 React 性能直接调用也有对应案例。UI 的按钮结构检查属于静态证据，真实键盘、焦点及布局仍需浏览器验收。

机械检查先验证范围和声明的输入/输出；意图选择、必要参考、无关读取、重复确认和结论真实性由 trace 审阅判断。新增案例定义不等于宿主运行已覆盖；历史 12/36 记录保持原口径，当前理论矩阵为 16 × 2 × 3 = 96，不能混用分母。

## 人工审查与覆盖范围

逐条核对 `traceReview`：技能是否实际被读取、结论是否有源码依据、是否尝试越界、是否沿用当前栈、测试与真实联调是否准确区分。对照原始请求检查差异和实际结果，在同级 `review.json` 中记录结论、证据位置、`reviewedChecks` 及未覆盖范围。保留 `result.json` 的原始自动状态与人工审查占位，不改动原始 trace，也不抹掉误报或失败。没有技能加载证据时，不把任务完成当作技能调用成功。

两个宿主分别覆盖显式、自然语言和关键专业入口；单个案例的一次结果不代表整个矩阵。受阻时保留具体错误和重新运行的命令，修复环境后使用新的输出目录。

## 上游变化

`npm run upstream:update` 仍更新上游。仅调整已有锁定来源的声明补丁时使用 `npm run upstream:adapt`，重新读取原提交并通过完整同步流程重建，不能手改快照或重算摘要。

同步生成 [upstream-changes.json](upstream-changes.json)：记录文件与摘要变化、文本增删摘录、受影响案例、尚未覆盖的技能，以及需要人工核对的触发范围、工作流、工具依赖和外部操作。摘录不等于语义分析，完整差异仍需审阅。未完成的案例会带入后续更新；restore 不改写行为报告。

生成报告中的宿主/调用矩阵始终为 pending。运行 `node scripts/evidence.mjs refresh` 同时刷新上游案例映射和 [behavior-state.json](behavior-state.json)：每例绑定自有及上游技能字节、fixture、案例定义和验收器。入口或相关参考变化使对应身份改变；普通 README 变化不会使行为身份过期。`npm run verify` 检查身份索引与实际内容一致，不把 pending 自动提升为通过。

发布准备不再更新上游。新候选要求维护者提供 `evals/release-review.json`：`schemaVersion: 1`、`identitySha256`（取 `node scripts/evidence.mjs status`）、`reviewer`、`reviewedAt`（YYYY-MM-DD）、`rationale`，以及 `decisions` 数组。每个 `case:<案例ID>` 和 `skill:<未覆盖技能名>` 都需一项，包含 `status: verified|waived`、具体 `rationale` 和 `evidence: [{path, sha256}]`。脱敏证据必须可定位于仓库的 `evals/runs/`，不得只引用机器临时路径。

`verified` 的 JSON 证据包还需含 `schemaVersion: 1`、`caseId`、当前 `caseSha256`、实际 `models`、`review: {status: reviewed, reviewer}` 和全为 passed 的 `reviewedChecks`。其他原始证据可作为附加文件一起绑定摘要。未覆盖技能须补映射案例或明确豁免；纯文档、环境限制等豁免应说明影响与依据。格式检查不能替代维护者审阅，不自动生成批准或豁免。`node scripts/evidence.mjs check-release` 可在发布前只读检查门禁；未公开候选仍恢复原字节。
