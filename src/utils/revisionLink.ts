// Build a clickable URL pointing at a specific commit on a Git host.
// Covers GitHub, GitLab, and Bitbucket out of the box. Self-hosted
// instances fall back to repoURL (still useful as a link).
export function commitURL(repoURL: string, revision: string | undefined): string | null {
  if (!repoURL || !revision) return null;
  const repo = repoURL.replace(/\.git$/, '').replace(/\/$/, '');

  if (repo.includes('github.com')) {
    return `${repo}/commit/${revision}`;
  }
  if (repo.includes('gitlab.com') || repo.includes('gitlab.')) {
    return `${repo}/-/commit/${revision}`;
  }
  if (repo.includes('bitbucket.org')) {
    return `${repo}/commits/${revision}`;
  }
  return repo; // self-hosted: at least take the user to the repo root
}

export function shortSHA(revision?: string): string {
  if (!revision) return '';
  return revision.length >= 7 ? revision.slice(0, 7) : revision;
}
