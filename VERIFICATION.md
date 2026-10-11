# v0.3.0 实际验证

日期：2026-10-11。环境：Linux、Node v24.19.0、npm 11.9.0、上游 skills 1.7.2。

## 分发与安装

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

现有 yuyin-dev 的全部 11 个源码文件与 v0.2.0 原包逐字节对照一致；本次不修改提示词或技能行为。旧 Skill 的合成任务验证仅作历史证据，不能证明真实业务效果。

## npm 发布状态

`npm publish --dry-run --ignore-scripts` 成功检查包内容，同时提示尚未登录。当前执行环境的 `npm whoami` 返回 ENEEDAUTH；用户自己的电脑上 `npm whoami` 返回 zhuzm。公开 registry 查询新包名返回 E404。**没有执行正式发布。** dry-run 成功不代表账号已在本环境授权 publish。

## 仍待实机确认

未运行公司的 CC/Codex 客户端、macOS、Windows 或公司业务系统；全局安装路径参考上游实现，本次只实测项目安装。测试期间 npm 自带更新通知曾尝试联网，加入 `--no-update-notifier` 后离线复测通过；指南已采用该命令。

本机安装文件可读只证明文件接入。上班请在一个真实项目的新会话确认 Skill 可见，再试只读逻辑、Bug 和小功能。内网用本地路径与 ZIP 内 CLI，不使用首次 npx 下载；CLI 遥测关闭。本次没有配置账号、模型或网关。
