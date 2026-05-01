import { test as base, expect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';

export const SETTINGS_RESPONSE = {
  port: 7411,
  watchDirectories: [],
  sessionRetentionHours: 24,
  outputRetentionMbPerSession: 10,
  autoRegisterRepos: false,
  yoloMode: false,
  restingThresholdMinutes: 20,
  telemetryEnabled: false,
  telemetryPromptSeen: true,
};

export const INTEGRATIONS_RESPONSE = {
  integrationsEnabled: false,
  slack: { connectionStatus: 'unconfigured', notifier: null, listener: null },
  teams: { connectionStatus: 'unconfigured', notifier: null, listener: null },
};

export const TOOLS_RESPONSE = {
  claude: true,
  copilot: false,
  claudeCmd: 'claude',
  copilotCmd: null,
};

/**
 * Extended test fixture that pre-registers mocks for every API endpoint that
 * the dashboard fetches on load. Tests that need to override a specific route
 * (e.g. a stateful settings mock) simply register their own route after setup;
 * Playwright's LIFO ordering ensures the test route takes precedence.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/v1/integrations', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(INTEGRATIONS_RESPONSE) })
    );
    await page.route('**/api/v1/settings', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SETTINGS_RESPONSE) })
    );
    await page.route('**/api/v1/tools**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(TOOLS_RESPONSE) })
    );
    await page.route('**/api/v1/todos**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('**/api/health', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', version: '0.0.0', uptime: 0 }) })
    );
    await page.routeWebSocket('**/ws', () => {});
    await use(page);
  },
});

export { expect };
export type { Page, BrowserContext };
