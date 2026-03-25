#!/bin/bash
# PostToolUse hook: lint TypeScript files after Edit/Write
INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only lint TypeScript files
if [[ ! "$FILE" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Run ESLint on the changed file
LINT_OUTPUT=$(cd "$CLAUDE_PROJECT_DIR" && bunx eslint --no-warn-ignored "$FILE" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  jq -n --arg reason "ESLint errors in $(basename "$FILE"):\n$LINT_OUTPUT" \
    '{"decision": "block", "reason": $reason}'
else
  exit 0
fi
