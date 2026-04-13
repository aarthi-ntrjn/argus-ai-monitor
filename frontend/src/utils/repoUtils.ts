const DEFAULT_BRANCHES = new Set(['master', 'main']);

export function buildGitHubCompareUrl(
  remoteUrl: string | null | undefined,
  branch: string | null | undefined
): string | null {
  if (!remoteUrl || !branch) return null;

  let baseUrl: string | null = null;

  if (remoteUrl.startsWith('https://github.com/')) {
    baseUrl = remoteUrl.replace(/\.git$/, '');
  } else if (remoteUrl.startsWith('git@github.com:')) {
    const path = remoteUrl.slice('git@github.com:'.length).replace(/\.git$/, '');
    baseUrl = `https://github.com/${path}`;
  }

  if (!baseUrl) return null;

  if (DEFAULT_BRANCHES.has(branch)) {
    return `${baseUrl}/compare`;
  }
  return `${baseUrl}/compare/master...${branch}`;
}
