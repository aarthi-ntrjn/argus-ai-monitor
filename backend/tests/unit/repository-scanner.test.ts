import { describe, it, expect, vi } from 'vitest';
import { buildGitHubCompareUrl } from '../../src/services/repository-scanner.js';

// getRemoteUrl is tested via buildGitHubCompareUrl's parsing logic.
// The git exec call itself is integration-level; we test the pure URL builder here.

describe('buildGitHubCompareUrl()', () => {
  describe('GitHub HTTPS remotes', () => {
    it('returns compare URL for a feature branch', () => {
      const url = buildGitHubCompareUrl('https://github.com/owner/repo.git', 'feature/my-feature');
      expect(url).toBe('https://github.com/owner/repo/compare/master...feature/my-feature');
    });

    it('strips .git suffix from HTTPS URL', () => {
      const url = buildGitHubCompareUrl('https://github.com/owner/repo.git', 'dev');
      expect(url).toContain('https://github.com/owner/repo/compare');
    });

    it('handles HTTPS URL without .git suffix', () => {
      const url = buildGitHubCompareUrl('https://github.com/owner/repo', 'fix/bug-123');
      expect(url).toBe('https://github.com/owner/repo/compare/master...fix/bug-123');
    });

    it('returns base /compare URL when on master branch', () => {
      const url = buildGitHubCompareUrl('https://github.com/owner/repo.git', 'master');
      expect(url).toBe('https://github.com/owner/repo/compare');
    });

    it('returns base /compare URL when on main branch', () => {
      const url = buildGitHubCompareUrl('https://github.com/owner/repo.git', 'main');
      expect(url).toBe('https://github.com/owner/repo/compare');
    });
  });

  describe('GitHub SSH remotes', () => {
    it('converts SSH format to HTTPS compare URL', () => {
      const url = buildGitHubCompareUrl('git@github.com:owner/repo.git', 'feature/my-feature');
      expect(url).toBe('https://github.com/owner/repo/compare/master...feature/my-feature');
    });

    it('strips .git suffix from SSH URL', () => {
      const url = buildGitHubCompareUrl('git@github.com:owner/repo.git', 'dev');
      expect(url).toContain('https://github.com/owner/repo');
    });

    it('returns base /compare URL for SSH remote on master', () => {
      const url = buildGitHubCompareUrl('git@github.com:owner/repo.git', 'master');
      expect(url).toBe('https://github.com/owner/repo/compare');
    });
  });

  describe('Non-GitHub remotes', () => {
    it('returns null for GitLab HTTPS remote', () => {
      const url = buildGitHubCompareUrl('https://gitlab.com/owner/repo.git', 'feature');
      expect(url).toBeNull();
    });

    it('returns null for Bitbucket remote', () => {
      const url = buildGitHubCompareUrl('https://bitbucket.org/owner/repo.git', 'feature');
      expect(url).toBeNull();
    });

    it('returns null for local/bare remote', () => {
      const url = buildGitHubCompareUrl('/home/user/repos/myrepo', 'feature');
      expect(url).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('returns null when remoteUrl is null', () => {
      const url = buildGitHubCompareUrl(null, 'feature');
      expect(url).toBeNull();
    });

    it('returns null when branch is null', () => {
      const url = buildGitHubCompareUrl('https://github.com/owner/repo.git', null);
      expect(url).toBeNull();
    });

    it('returns null when both are null', () => {
      const url = buildGitHubCompareUrl(null, null);
      expect(url).toBeNull();
    });
  });
});
