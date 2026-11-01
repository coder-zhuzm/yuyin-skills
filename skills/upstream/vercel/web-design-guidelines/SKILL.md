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
3. Establish the actual semantics and interaction contract from source roles, implemented behavior, user requirements and supplied rules. A pattern label inferred by the reviewer remains a hypothesis, not an additional requirement.
4. For each violation, cite the applicable rule or established requirement and the source mismatch. Missing capabilities are violations only where that rule/requirement calls for them. Keep conventions from other navigation, disclosure, menu or dialog patterns as conditional recommendations, with their prerequisites stated.
5. Distinguish static findings from behavior needing a running page or browser. Missing execution tools are environment limitations; describe a project prohibition only when an actual instruction establishes one.

If no files are specified, resolve the relevant scope from the current task; ask only when it cannot be determined.

Adapted by yuyin-skills to use a locked local snapshot. The bundled rule resource retains its [MIT license](references/WEB-INTERFACE-LICENSE.txt); provenance and adaptation records are in the distribution's SOURCES.md and upstream lock.
