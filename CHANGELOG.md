# 变更记录

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
