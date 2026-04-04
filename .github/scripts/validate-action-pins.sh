#!/usr/bin/env bash
# validate-action-pins.sh
#
# Validates that every third-party GitHub Action referenced in workflow files
# includes a full 40-character commit SHA pin. Mutable version tags alone
# (e.g., @v4) are rejected.
#
# Usage: bash .github/scripts/validate-action-pins.sh
# Exit 0: all references are pinned
# Exit N: N unpinned references found (each reported to stdout)
#
# Exemptions:
#   - Local actions starting with "./" are skipped (version-controlled in repo)

set -euo pipefail

ERRORS=0
WORKFLOW_DIR=".github/workflows"

if [ ! -d "$WORKFLOW_DIR" ]; then
  echo "ERROR: Workflow directory '$WORKFLOW_DIR' not found." >&2
  exit 1
fi

# Find all .yml files in the workflows directory
while IFS= read -r -d '' file; do
  lineno=0
  while IFS= read -r line; do
    lineno=$((lineno + 1))
    # Match lines containing "uses:" (with optional leading whitespace)
    if echo "$line" | grep -qE '^\s+uses:\s+\S+'; then
      # Extract the value after "uses:"
      uses_value=$(echo "$line" | sed -E 's/^\s+uses:\s+(\S+).*/\1/')

      # Skip local actions (starts with "./")
      if [[ "$uses_value" == ./* ]]; then
        continue
      fi

      # Check for a 40-character lowercase hex SHA after "@"
      # Pattern: @[0-9a-f]{40} anywhere in the reference
      if ! echo "$uses_value" | grep -qE '@[0-9a-f]{40}'; then
        echo "UNPINNED: $file:$lineno  uses: $uses_value"
        ERRORS=$((ERRORS + 1))
      fi
    fi
  done < "$file"
done < <(find "$WORKFLOW_DIR" -name "*.yml" -print0)

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS unpinned action reference(s)."
  echo "Pin each action to a full commit SHA. See .github/supply-chain/action-shas.md"
  echo "for the current SHAs and instructions for resolving new ones."
  exit "$ERRORS"
fi

echo "All action references are pinned to commit SHAs. ✓"
exit 0
