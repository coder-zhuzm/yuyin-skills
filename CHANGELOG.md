# 变更记录

## 0.3.2

- chore: refresh curated upstream skill snapshots [skip ci] (3e9180f)
- feat: curate reusable development skills and enable manual patch releases (6ab59d1)

## Unreleased

- 手动发版留空版本自动分配新补丁版本；保留自动发布的变化检查和失败候选恢复，并明确 Actions 发布摘要。
- 清理通用入口的历史项目绑定，按真实技术栈与版本选择专业能力。
- 接入 React、Spring、Node、UI 与测试的精选社区快照及组合安装。
- 新版本准备同步上游并锁定提交、资源与许可；恢复候选保持原内容。
- 扩展资源完整性、安装冲突、离线分发及同步失败回滚验证。

## 0.3.1

- docs: describe automatic releases and maintainer checks (f5a481e)
- ci: configure trusted npm publishing and release recovery [skip ci] (797d8ec)

## 0.3.0

- 整理仓库首页、安装指南与开发手册，统一描述性语言和文档导航。
- 使用现成 Vercel skills CLI 1.7.2，锁定依赖；仅选择 CC 与 Codex。
- npm 包改为纯 Skill/参考资料/模板，不包含自制 CLI、current 版本切换或 payload 构建器。
- 现有 yuyin-dev 的 11 个文件内容保持 v0.2.0 原样。
- 提供本地目录、npm tgz、附上游依赖的离线 ZIP 接入方式；更新和回退重新 add。
- npm 内容包名称为 `@zhuzm/yuyin-skills`。

## 0.2.0（历史附件保留）

使用自制 Node CLI 的离线 npm 分发、分类预留与项目事实管理。详见 `docs/history/v0.2-npm-guide.md`。

## 0.1.0（历史附件保留）

初始个人开发流程与 Python 离线管理工具。详见 `docs/history/v0.1-development-workflow.md`。
