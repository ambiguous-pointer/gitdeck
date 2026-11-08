import type { Remote } from '@gitdeck/shared';

/**
 * Turn a git remote URL into a browsable commit URL on the hosting provider.
 *
 * Supports https://, ssh:// and scp-like `git@host:owner/repo.git` remotes for
 * GitHub, GitLab, Bitbucket and generic hosts (falling back to `/commit/<hash>`).
 */
export function commitWebUrl(remoteUrl: string | undefined, hash: string): string | undefined {
  const base = normalizeRemoteBase(remoteUrl);
  if (!base || !hash) return undefined;
  const host = base.toLowerCase();
  if (host.includes('gitlab.')) return `${base}/-/commit/${hash}`;
  if (host.includes('bitbucket.')) return `${base}/commits/${hash}`;
  return `${base}/commit/${hash}`;
}

export function normalizeRemoteBase(remoteUrl: string | undefined): string | undefined {
  if (!remoteUrl) return undefined;
  let value = remoteUrl.trim();
  if (!value) return undefined;

  if (value.startsWith('git@')) {
    // scp-like syntax: git@github.com:owner/repo.git
    const match = /^git@([^:]+):(.+)$/.exec(value);
    if (!match) return undefined;
    value = `https://${match[1]}/${match[2]}`;
  } else if (value.startsWith('ssh://')) {
    value = value.replace(/^ssh:\/\/(?:git@)?([^/]+)\/?/, 'https://$1/');
  } else if (value.startsWith('http://')) {
    value = `https://${value.slice('http://'.length)}`;
  } else if (!/^https:\/\//.test(value)) {
    return undefined;
  }

  value = value.replace(/\.git$/i, '').replace(/\/+$/, '');
  try {
    const url = new URL(value);
    if (!url.hostname) return undefined;
  } catch {
    return undefined;
  }
  return value;
}

/** Pick the most relevant remote URL (upstream remote first, then origin). */
export function pickRemoteUrl(remotes: Remote[] | undefined, mentioned?: string): string | undefined {
  if (!remotes || remotes.length === 0) return undefined;
  if (mentioned) {
    const match = remotes.find((remote) => remote.name === mentioned);
    if (match) return match.fetchUrl;
  }
  const origin = remotes.find((remote) => remote.name === 'origin');
  return (origin ?? remotes[0])!.fetchUrl;
}
