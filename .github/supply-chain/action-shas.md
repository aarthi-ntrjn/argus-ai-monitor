# Pinned Action SHAs

Resolved via `git ls-remote` on 2026-04-03. Re-resolve when bumping action versions.

```
actions/checkout@v4.3.1    = 34e114876b0b11c390a56381ad16ebd13914f8d5
actions/setup-node@v4.4.0  = 49933ea5288caeca8642d1e84afbd3f7d6820020
actions/dependency-review-action@v4.9.0 = 2031cfc080254a8a887f58cffee85186f0e49e48
```

## How to re-resolve

```sh
git ls-remote https://github.com/actions/checkout "refs/tags/v4.*" | tail -1
git ls-remote https://github.com/actions/setup-node "refs/tags/v4.*" | tail -1
git ls-remote https://github.com/actions/dependency-review-action "refs/tags/v4.*" | tail -1
```

Replace the SHA in the workflow file with the new value and add an inline `# vX.Y.Z` comment.
