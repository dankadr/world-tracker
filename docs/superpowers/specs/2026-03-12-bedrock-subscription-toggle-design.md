# Design: Claude Code Bedrock/Subscription Toggle Script

**Date:** 2026-03-12
**Status:** Approved

## Problem

Claude Code's active model is stored in `~/.claude/settings.json` under the `"model"` key. Bedrock models use a region-prefixed ID (e.g. `eu.anthropic.claude-sonnet-4-6`) while subscription models use a plain ID (e.g. `claude-sonnet-4-6`). Switching between them currently requires manually editing the JSON file.

## Solution

A bash script at `~/bin/toggle-claude` that detects the current mode from the model ID and toggles it.

## Design

### Location

`~/bin/toggle-claude` — globally accessible as a shell command (assumes `~/bin` is on `$PATH`).

### Logic

1. Read `~/.claude/settings.json` with `python3`
2. Extract the current `"model"` value
3. If it starts with `eu.anthropic.` → strip the prefix → switch to subscription mode
4. Otherwise → prepend `eu.anthropic.` → switch to Bedrock mode
5. Write the updated JSON back in place using `python3`
6. Print a confirmation message

### Example Output

```
$ toggle-claude
Switched to subscription: claude-sonnet-4-6

$ toggle-claude
Switched to bedrock: eu.anthropic.claude-sonnet-4-6
```

### Dependencies

- `bash` (always available)
- `python3` (built-in on macOS)
- No third-party packages or state files

### Assumptions

- Bedrock and subscription model IDs have a simple `eu.anthropic.` prefix relationship (true for all current Claude models on EU Bedrock)
- `~/bin` is on `$PATH`
- `~/.claude/settings.json` always has a `"model"` key (set it manually once if not present)

## Out of Scope

- Supporting multiple Bedrock regions (only `eu` needed)
- Interactive model picker
- Support for models with version suffixes that differ between Bedrock and subscription
