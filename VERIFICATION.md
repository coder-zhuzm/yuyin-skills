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
