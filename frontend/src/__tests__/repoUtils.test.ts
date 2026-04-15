import { describe, it, expect } from 'vitest';
import { buildGitHubCompareUrl } from '../utils/repoUtils';

describe('buildGitHubCompareUrl', () => {
  it('returns null when remoteUrl is null', () => {
    expect(buildGitHubCompareUrl(null, 'my-feature')).toBeNull();
  });

  it('returns null when branch is null', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', null)).toBeNull();
  });

  it('returns null for non-GitHub remote', () => {
    expect(buildGitHubCompareUrl('https://gitlab.com/owner/repo', 'feature')).toBeNull();
  });

  it('builds compare URL for HTTPS remote on feature branch', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', 'my-feature'))
      .toBe('https://github.com/owner/repo/compare/master...my-feature');
  });

  it('strips .git suffix from HTTPS remote', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo.git', 'feature'))
      .toBe('https://github.com/owner/repo/compare/master...feature');
  });

  it('converts SSH remote to HTTPS and builds compare URL', () => {
    expect(buildGitHubCompareUrl('git@github.com:owner/repo.git', 'feature'))
      .toBe('https://github.com/owner/repo/compare/master...feature');
  });

  it('returns base compare URL when on master branch', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', 'master'))
      .toBe('https://github.com/owner/repo/compare');
  });

  it('returns base compare URL when on main branch', () => {
    expect(buildGitHubCompareUrl('https://github.com/owner/repo', 'main'))
      .toBe('https://github.com/owner/repo/compare');
  });
});
