# Contract: Settings Panel Threshold Control

This feature is frontend-only with no new API endpoints. The contract is the component interface and localStorage schema.

## SettingsPanel Props Contract

### Before

```typescript
interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onRestartTour?: () => void;
}
```

### After

```typescript
interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onUpdateThreshold?: (minutes: number) => void;  // NEW - called with valid integer 1-1440
  onRestartTour?: () => void;
}
```

`onUpdateThreshold` is optional (defaults to no-op). It is called ONLY with a validated value (1-1440 integer). Invalid inputs trigger an inline error state within the component and do NOT call the callback.

## localStorage Schema

Key: `argus:settings`

```json
{
  "hideEndedSessions": false,
  "hideReposWithNoActiveSessions": false,
  "hideInactiveSessions": false,
  "outputDisplayMode": "focused",
  "restingThresholdMinutes": 20
}
```

Missing `restingThresholdMinutes` (legacy stored objects) defaults to 20 via the spread merge in `useSettings`.

## Validation Rules

| Condition | Error Message |
|-----------|---------------|
| Empty or non-numeric | "Enter a number between 1 and 1440." |
| Less than 1 | "Minimum is 1 minute." |
| Greater than 1440 | "Maximum is 1440 minutes (24 hours)." |
| Decimal value | Silently rounded to nearest integer before validation |

## Test Case Table

| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| Default render | (none) | Input shows 20 |
| Valid update | 5 | onUpdateThreshold(5) called, no error shown |
| Reset | click Reset | onUpdateThreshold(20) called, input shows 20 |
| Below minimum | 0 | Error shown, callback NOT called |
| Above maximum | 9999 | Error shown, callback NOT called |
| Non-numeric | "abc" | Error shown, callback NOT called |
| Empty | "" | Error shown, callback NOT called |
| Decimal | 5.7 | Rounded to 6, onUpdateThreshold(6) called |
