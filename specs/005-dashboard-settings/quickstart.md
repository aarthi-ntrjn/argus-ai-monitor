# Quickstart: Dashboard Settings

## For Users

### Toggling Ended Session Visibility

1. Open the Argus dashboard (`http://localhost:7411`)
2. Click the **gear icon** () in the dashboard header/toolbar
3. In the settings panel, find **"Show ended sessions"**  it is on by default
4. Toggle it off to hide all completed/ended sessions from the repository cards
5. Toggle it back on to show them again

Your preference is automatically saved and will be restored the next time you open the dashboard.

### Empty State

If "Show ended sessions" is off and all sessions in a repository card are ended, the card shows an empty-state message instead of a blank area.

---

## For Developers

### Adding a New Setting

1. Add the new field with a default to the `DashboardSettings` type in `frontend/src/types.ts`
2. Update the `DEFAULT_SETTINGS` constant in `frontend/src/hooks/useSettings.ts`
3. Add a UI control for it in `frontend/src/components/SettingsPanel/SettingsPanel.tsx`
4. Consume it via `const { settings } = useSettings()` in any component

The `useSettings` hook handles localStorage persistence automatically  no additional wiring required.

### localStorage Key

All settings are stored under a single key: `argus:settings` (JSON).

### Identifying "Ended" Sessions

A session is considered ended if `session.status === 'completed' || session.status === 'ended'`. This is defined in the filter inside `DashboardPage.tsx`.
