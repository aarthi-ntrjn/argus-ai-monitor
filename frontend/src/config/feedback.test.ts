import { describe, it, expect } from 'vitest';
import { ARGUS_GITHUB_REPO_URL, buildBugReportUrl, buildFeatureRequestUrl } from './feedback';

describe('feedback URL builders', () => {
  describe('buildBugReportUrl', () => {
    it('returns a URL starting with the Argus GitHub repo URL', () => {
      expect(buildBugReportUrl()).toMatch(/^https:\/\/github\.com\/aarthi-ntrjn\/argus\/issues\/new/);
    });

    it('uses the bug_report.md template', () => {
      const url = buildBugReportUrl();
      expect(new URL(url).searchParams.get('template')).toBe('bug_report.md');
    });
  });

  describe('buildFeatureRequestUrl', () => {
    it('returns a URL starting with the Argus GitHub repo URL', () => {
      expect(buildFeatureRequestUrl()).toMatch(/^https:\/\/github\.com\/aarthi-ntrjn\/argus\/issues\/new/);
    });

    it('uses the feature_request.md template', () => {
      const url = buildFeatureRequestUrl();
      expect(new URL(url).searchParams.get('template')).toBe('feature_request.md');
    });
  });

  describe('ARGUS_GITHUB_REPO_URL', () => {
    it('is the correct public repo URL', () => {
      expect(ARGUS_GITHUB_REPO_URL).toBe('https://github.com/aarthi-ntrjn/argus');
    });
  });
});
