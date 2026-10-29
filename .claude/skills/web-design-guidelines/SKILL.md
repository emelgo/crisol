---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the guidelines in `guidelines.md` next to this file
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

`guidelines.md` is a pinned copy of `command.md` from `vercel-labs/web-interface-guidelines` (commit
`434b7f91364665f2f733b310ec54809bf8f37937`, MIT, see `../LICENSE-vercel`). Crisol keeps it in the repo instead of
fetching it on every review, so the rules only change when someone updates the copy on purpose.

## Crisol

Where a rule is about English copy, Spanish conventions win:

- Sentence case for headings and buttons (only the first word capitalised), not Title Case.
- Spanish quotes «» in interface text; “” only inside quoted text.
- Interface copy is written through i18n (`apps/web/src/i18n.ts`), never hardcoded.

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
