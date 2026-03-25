#!/bin/bash
# Stop hook: verify build passes before Claude finishes
BUILD_OUTPUT=$(cd "$CLAUDE_PROJECT_DIR" && bun run build 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  # Show last 30 lines of build output
  TRIMMED=$(echo "$BUILD_OUTPUT" | tail -30)
  jq -n --arg reason "Build failed. Fix before finishing:\n$TRIMMED" \
    '{"decision": "block", "reason": $reason}'
else
  exit 0
fi
