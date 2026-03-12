# Bedrock/Subscription Toggle Script Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `~/bin/toggle-claude`, a shell command that toggles Claude Code between AWS Bedrock and Anthropic subscription model IDs by editing `~/.claude/settings.json` in place.

**Architecture:** Single bash script that uses python3 to safely read and write the JSON config file. Detects current mode from the model ID itself (Bedrock = `eu.anthropic.` prefix, subscription = plain `claude-*` ID). No state files needed.

**Tech Stack:** bash, python3 (built-in on macOS)

---

## Chunk 1: Create and verify the toggle script

### Task 1: Create the toggle-claude script

**Files:**
- Create: `~/bin/toggle-claude`

- [ ] **Step 1: Write the script**

Create `~/bin/toggle-claude` with these exact contents:

```bash
#!/usr/bin/env bash
set -euo pipefail

SETTINGS="$HOME/.claude/settings.json"

if [[ ! -f "$SETTINGS" ]]; then
  echo "Error: $SETTINGS not found" >&2
  exit 1
fi

python3 - "$SETTINGS" <<'EOF'
import sys, json

path = sys.argv[1]
with open(path) as f:
    data = json.load(f)

model = data.get("model", "")
if not model:
    print("Error: no 'model' key found in settings.json", file=sys.stderr)
    sys.exit(1)

BEDROCK_PREFIX = "eu.anthropic."

if model.startswith(BEDROCK_PREFIX):
    new_model = model[len(BEDROCK_PREFIX):]
    mode = "subscription"
else:
    new_model = BEDROCK_PREFIX + model
    mode = "bedrock"

data["model"] = new_model

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print(f"Switched to {mode}: {new_model}")
EOF
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x ~/bin/toggle-claude
```

- [ ] **Step 3: Verify the script is on PATH**

```bash
which toggle-claude
```

Expected output: `/Users/<you>/bin/toggle-claude`

If not found, add `export PATH="$HOME/bin:$PATH"` to your `~/.zshrc` and run `source ~/.zshrc`.

- [ ] **Step 4: Check current model before testing**

```bash
python3 -c "import json; d=json.load(open('$HOME/.claude/settings.json')); print('Current model:', d['model'])"
```

Note the current value so you can verify the toggle.

- [ ] **Step 5: Run the script once — should toggle away from current mode**

```bash
toggle-claude
```

Expected (if currently on Bedrock `eu.anthropic.claude-sonnet-4-6`):
```
Switched to subscription: claude-sonnet-4-6
```

Expected (if currently on subscription `claude-sonnet-4-6`):
```
Switched to bedrock: eu.anthropic.claude-sonnet-4-6
```

- [ ] **Step 6: Run it again — should toggle back**

```bash
toggle-claude
```

Expected: back to original mode and model ID.

- [ ] **Step 7: Verify the JSON file is still valid after two toggles**

```bash
python3 -c "import json; json.load(open('$HOME/.claude/settings.json')); print('JSON valid')"
```

Expected: `JSON valid`

- [ ] **Step 8: Commit**

```bash
# The script lives outside the repo, nothing to commit here.
# Optionally note its existence in memory or docs.
echo "Done — toggle-claude is live at ~/bin/toggle-claude"
```
