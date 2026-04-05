# Contract: Onboarding State — localStorage Schema

**Version**: 1.0.0 | **Date**: 2026-04-04  
**Storage Key**: `argus:onboarding`  
**Stability**: Stable (v1)

## Overview

The `argus:onboarding` localStorage key stores all client-side onboarding state for the Argus application. This contract defines the exact JSON shape, type constraints, validation rules, and migration protocol.

---

## Schema (v1)

```typescript
interface OnboardingState {
  schemaVersion: 1;
  userId: string | null;
  dashboardTour: {
    status: 'not_started' | 'completed' | 'skipped';
    completedAt: string | null;  // ISO 8601, e.g. "2026-04-04T03:10:00.000Z"
    skippedAt: string | null;    // ISO 8601
  };
  sessionHints: {
    dismissed: string[];         // Array of hint IDs
  };
}
```

## Serialisation

The value is stored as a `JSON.stringify`-encoded string. Consumers MUST use `JSON.parse` with a `try/catch` guard; a parse failure MUST be treated as a missing / corrupt state, triggering initialisation of the default state.

## Read Protocol

```
1. Read localStorage.getItem('argus:onboarding')
2. If null or empty → initialise default state, write to localStorage, return default
3. Try JSON.parse
   - On error → initialise default state, write to localStorage, return default
4. If schemaVersion > CURRENT_SCHEMA_VERSION → treat as unrecognised, return default (do NOT overwrite — preserve for future migration)
5. Return parsed state
```

## Write Protocol

```
1. Mutate a copy of current state
2. JSON.stringify the full OnboardingState object
3. Try localStorage.setItem('argus:onboarding', serialised)
   - On SecurityError / QuotaExceededError → log warning, do NOT throw — tour continues in-memory for the session
```

## Versioning & Migration

- `schemaVersion` is a monotonically increasing integer.
- Breaking changes (field removal, type change) MUST increment the version and include a migration function in `onboardingStorage.ts`.
- Additive changes (new optional field) MAY use the same version if the read protocol handles missing fields with safe defaults.
- Future v2 migration: when `userId` becomes non-null (post-auth), a migration service reads the v1 blob and syncs to the user profile API. The v1 localStorage entry is then tombstoned (set to `{ schemaVersion: 2, migrated: true }`).

## Default State

```json
{
  "schemaVersion": 1,
  "userId": null,
  "dashboardTour": {
    "status": "not_started",
    "completedAt": null,
    "skippedAt": null
  },
  "sessionHints": {
    "dismissed": []
  }
}
```

## Reset Contract

A "Reset Onboarding" action MUST write the default state above to localStorage and return it. It MUST NOT clear the key — it must write the default state so the `schemaVersion` is preserved.
