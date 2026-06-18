---
name: todo
description: Append a TODO item to the repo's TODO.md for future work. Use when the user types /todo followed by something they want recorded for later.
argument-hint: [the todo item to add]
---

# Add a TODO item

Append the user's item to `TODO.md` at the repo root (`/Users/ccunningham/cargurus/pr-controller/TODO.md`).

## Steps

1. The item to add is: `$ARGUMENTS`
2. If `TODO.md` does not exist at the repo root, create it with a `# TODO` heading.
3. Append the item as a new unchecked checklist line: `- [ ] <item>`.
   - Preserve the user's wording. Lightly tidy obvious typos only; do not paraphrase or expand.
   - Add it to the bottom of the list.
4. Confirm in one short sentence what was added.

## Notes
- This is a capture tool: be fast and minimal. Do NOT start working on the item, research it, or ask clarifying questions unless the item is genuinely unintelligible.
- If `$ARGUMENTS` is empty, ask the user what they want to add.
