# 验证记录

## v0.3.0 分发集成验证

日期：2026-10-11。记录环境：Linux、Node v24.19.0、npm 11.9.0、上游 skills 1.7.2。以下为该环境的既有验证记录。

### 分发与安装

执行标准 `npm ci --ignore-scripts --no-audit --no-fund`，由 package-lock.json 锁定上游及传递依赖。执行 `npm pack --ignore-scripts` 并测试真实生成的内容 tarball。

13 项集成检查通过：

1. 从完整仓库的嵌套目录发现唯一实际 Skill。
2. 明确选择 CC/Codex，CC 软链接到 Codex 使用的标准副本；SKILL.md 和全部 references 内容一致。
3. 重复 add 成功。
4. 保留既有 CLAUDE.md、AGENTS.md、.gitignore 和项目事实；不生成 Cursor/Gemini 入口。
5. list 列出两者已安装的 Skill。
6. 源码修改不会自动影响副本；重新 add 更新，再从原快照 add 回退，两者一致。
7. remove 清除两个入口，项目事实保留。
8. 只选 Claude Code 的单工具安装可读。
9. 只选 Codex 的单工具安装可读，不建立 CC 入口。
10. --copy 安装为独立可读副本。
11. 真实 npm tgz 使用空缓存、offline、关闭 update notifier 后安装成功；无运行时依赖；上游 CLI 接入安装后的内容成功。
12. tarball 无自制 bin/lib、node_modules 或历史工具文档。
13. 在测试进程中阻断 Node fetch/http/https/socket 的所有联网调用，以上命令仍成功且未记录联网尝试。

另做实际 v0.2 Node CLI 的 setup → detach → 新 skills add 迁移，项目事实保留。

现有 yuyin-dev 的全部 11 个源码文件与 v0.2.0 原包逐字节对照一致；技能行为保持一致。旧 Skill 的合成任务验证仅作历史证据，不能证明真实业务效果。

## v0.3.0 macOS 发布准备验证

日期：2026-10-11。环境：macOS、Node v24.21.0、npm 11.19.0、skills 1.7.2。

- 检查仓库 Markdown 的代码块与本地链接，确认包名与锁文件一致。
- 安装锁定的维护依赖，生成并检查真实 npm tarball；内容包包含第三方许可，无运行时依赖、Git 元数据、历史工具或 `node_modules`。
- 使用空缓存离线安装 tarball，核对 README 与全部 11 个技能文件的内容。
- 在临时项目接入 Claude Code 与 Codex，验证共享副本、Claude Code 链接及 `list` 结果。
- 验证完整移除命令 `remove yuyin-dev -y`，确认已有规则、Git 忽略配置与项目上下文保留。

限定 Agent 的移除可能保留其他检测到的 Agent 仍使用的共享目录；完整移除与指定入口移除应分别验收。

## 验证边界

上述记录覆盖项目安装、分发与迁移。Agent 运行时识别、真实业务任务、Windows 和用户级安装仍需在目标环境验证。

文件可读性证明安装内容可用；技能效果需通过新会话中的显式调用和真实任务验收确认。离线安装使用本地来源与归档内 CLI，关闭安装工具遥测及 npm 更新通知。


## 通用组合与上游快照验证（未发布改造）

日期：2026-10-13。环境：macOS、Node v24.21.0、npm 11.19.0、skills 1.7.2。本轮实际获取 5 个 GitHub 来源，生成 8 个社区技能、113 个快照资源；自有入口为 yuyin-dev。完整提交、逐文件 SHA-256、许可审阅摘要与适配记录见 upstream/lock.json。

### 实际执行

- `node --test tests/*.test.mjs`：39 项通过，0 失败，0 跳过。
- `node scripts/verify.mjs`：自有 Markdown、工作流权限与 141 个分发文件核对通过。
- `node scripts/upstream.mjs check`：8 个技能及 113 个快照资源通过离线摘要、模式、名称、许可与代码白名单核对。
- 在独立临时目录按 5 个真实来源的锁定提交执行 restore，重建全部资源；重建前后 lock.json 字节一致。
- `git diff --check` 通过，临时快照、测试目录与一次性工具缓存清理完毕。

### 测试覆盖

真实本地 CLI 安装全部组合，分别验证 Claude Code / Codex 的共享链接和独立副本、资源字节一致、原项目指令与 package.json 保留；安装进程阻断 Node fetch/http/https/socket 网络接口。明确接受 skills 1.7.2 排除 metadata.json 与缓存目录的原生行为，发行源快照仍完整保存。

实际生成内容 tgz，使用空 npm 缓存和 offline 模式安装，并从安装后的包本地接入全部技能，逐文件核对归档内容。内容包无运行时依赖，维护脚本未进入包。

同步测试覆盖：手动改动保护、失败批次保留旧快照、固定提交恢复、错误路径/符号链接/悬空引用、审阅脚本变更阻断、锁定技能集合、许可全文或 README 许可声明变化阻断。组合入口验证显式目标与 Agent、重叠去重、已有同名冲突，以及 CLI 返回 0 但未实际安装的错误。

发布测试在临时 Git 仓库和本地 bare remote 中验证候选快照、后续变更隔离、并发 push 拒绝；单元测试验证未公开候选不刷新上游，新准备检查上游变化，版本与已有 tag/归档身份保持约束。没有向真实远端推送或发布。

### 独立审查与行为验收

独立代码审查发现许可变化缺少审阅检查、上游 CLI 部分失败可能返回 0 两个问题，已修复并加入对应测试；复审无新增发现。

独立只读行为验收覆盖 React 18 + Vite + MUI 的 300ms 防抖、Spring Boot 2.7 + Java 11 + MyBatis 重复请求、Node 18 + Express + CommonJS 只读超时分析、已有 JS Playwright 的 UI 审查，以及缺少上游技能时的可行性评估。能从入口正确选择或排除相关指南，不要求架构、持久层、视觉或测试框架迁移。该验收是指令行为演练，没有真实业务项目源码，不能证明实际修复效果。

### 当前边界

真实 GitHub Actions / npm OIDC 发布、真实业务联调、目标 Agent 新会话识别、Windows 与用户级安装未在本轮验证。官方 skill-creator 的 Python quick_validate 因本机缺 PyYAML 未运行成功；未为此安装依赖，使用已存在的 Node yaml 检查入口名称、description、字段与占位符，并由仓库校验检查所有技能 frontmatter。

本轮保留工作区供审阅，没有提交、推送或正式发布；包版本仍为 0.3.1，已发布的同版本包不包含本轮新内容。正式发布准备将按现有机制分配新版本。


## 手动发布行为修正验证（未推送）

日期：2026-10-13。本轮仅基于本地代码与测试，未新增外部检索。

- 手动 workflow_dispatch 留空版本、无内容变化时分配下一补丁版本；push 无变化保持跳过。
- 未发布候选优先恢复；恢复后的 catchup 明确使用 prepare --if-changed，避免同一手动恢复额外分配空版本。
- 摘要区分跳过、准备、恢复、已发布并验证与执行失败，成功声明只在公开包及 GitHub Release 校验完成后写入。
- 在没有预先修改版本或内容的临时 Git 仓库实际生成新候选包，并验证候选提交可重建相同归档；使用本地 bare remote，没有向真实远端推送。
- 实际 CLI 错误测试确认 Actions 摘要记录发布未完成；自动检查初次 prepare 与 catchup 调用方式。
- 全量测试 45 项通过、0 失败、0 跳过；分发校验核对 141 个文件，git diff --check 通过。独立审查未发现问题。

改动保留为本地未提交差异，便于与此前技能改造统一审阅；未触发真实 Actions 或 npm 发布。远端手动触发规则在提交推送后才更新。


## 提交前核对

自有改动的暂存差异检查通过。新增的上游原文含 Markdown 换行空格、示例缩进空行与许可末尾空格，完整快照按已锁定字节保留；未为格式检查改写上游内容。全量资源摘要核对与分发验证通过。
