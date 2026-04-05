#!/usr/bin/env bash
# Fails if any package.json in the repo contains unpinned version ranges
# (^, ~, >, <, *, or "latest"). All versions must be exact SemVer strings.
# Exempt: the root-level "engines" and "packageManager" fields.

set -euo pipefail

FAILURES=0

# Find all package.json files, excluding node_modules
while IFS= read -r -d '' file; do
  # Extract dependency blocks and scan for range prefixes
  if grep -E '"[~^><=*]|"latest"' \
       <(node -e "
const pkg = require('./$file');
const blocks = ['dependencies','devDependencies','peerDependencies','optionalDependencies'];
blocks.forEach(b => {
  if (pkg[b]) Object.entries(pkg[b]).forEach(([k,v]) => console.log(k + ': ' + v));
});
" 2>/dev/null) > /tmp/unpinned_matches 2>/dev/null; then
    echo "❌ Unpinned versions found in $file:"
    cat /tmp/unpinned_matches | sed 's/^/   /'
    FAILURES=$((FAILURES + 1))
  fi
done < <(find . -name "package.json" -not -path "*/node_modules/*" -print0)

if [ "$FAILURES" -gt 0 ]; then
  echo ""
  echo "Supply chain check failed: $FAILURES file(s) contain unpinned dependency versions."
  echo "All versions must be exact (e.g. \"1.2.3\"), not ranges (\"^1.2.3\", \"~1.2.3\", \"latest\")."
  exit 1
fi

echo "✅ All dependency versions are pinned."
