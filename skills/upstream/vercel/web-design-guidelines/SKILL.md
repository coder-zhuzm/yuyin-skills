---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines


Review UI code using the rules bundled in [references/web-interface-guidelines.md](references/web-interface-guidelines.md).

## How to Review

1. Read the local guideline snapshot; do not fetch remote rules during a review.
2. Read the files requested by the user, preserving their design system and task scope.
3. Check applicable rules and report actionable findings with file and line references.
4. Distinguish static findings from behavior that needs a running page or browser verification.

If no files are specified, resolve the relevant scope from the current task; ask only when it cannot be determined.

## Source and Adaptation

This file is adapted by yuyin-skills to use a release-locked local resource. The upstream skill normally fetches rules from [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) at runtime. Source commits and this patch are recorded in the distribution's upstream lock. The local rule resource retains its [MIT license](references/WEB-INTERFACE-LICENSE.txt).
