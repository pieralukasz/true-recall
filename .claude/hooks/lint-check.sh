#!/bin/bash
# PostToolUse hook: lint TypeScript files after Edit/Write
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only lint TypeScript files in the plugin src/
if [[ ! "$FILE" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Run Biome check on the changed file
LINT_OUTPUT=$(cd "$CLAUDE_PROJECT_DIR" && bunx biome check --no-errors-on-unmatched "$FILE" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  jq -n --arg reason "Biome errors in $(basename "$FILE"):\n$LINT_OUTPUT" \
    '{"decision": "block", "reason": $reason}'
else
  exit 0
fi
