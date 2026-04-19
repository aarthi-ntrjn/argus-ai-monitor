export const ARGUS_GITHUB_REPO_URL = 'https://github.com/aarthi-ntrjn/argus';

export function buildBugReportUrl(): string {
  return `${ARGUS_GITHUB_REPO_URL}/issues/new?template=bug_report.md`;
}

export function buildFeatureRequestUrl(): string {
  return `${ARGUS_GITHUB_REPO_URL}/issues/new?template=feature_request.md`;
}
