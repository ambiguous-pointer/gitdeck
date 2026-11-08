import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config, ensureDataDir } from './config';
import { createApp, logger } from './app';

const execFileAsync = promisify(execFile);

async function readGitVersion(): Promise<string> {
  try {
    const { stdout } = await execFileAsync(config.gitPath, ['--version'], { timeout: 10_000 });
    return stdout.trim().replace(/^git version\s+/i, '');
  } catch {
    logger.warn({ gitPath: config.gitPath }, 'git executable not found');
    return 'not-found';
  }
}

async function main(): Promise<void> {
  ensureDataDir();
  const gitVersion = await readGitVersion();
  const app = createApp({ gitVersion });

  const server = app.listen(config.port, config.host, () => {
    logger.info(
      {
        url: `http://${config.host}:${config.port}`,
        dataDir: config.dataDir,
        webDist: config.webDist,
        gitVersion,
      },
      'GitDeck server listening',
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main();
