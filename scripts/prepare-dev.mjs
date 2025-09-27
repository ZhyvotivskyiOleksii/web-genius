import fs from 'fs/promises';
import path from 'path';

async function removeNextBuildArtifacts() {
  const nextDir = path.join(process.cwd(), '.next');
  try {
    await fs.rm(nextDir, { recursive: true, force: true });
    console.log('Cleared stale .next directory before dev server start.');
  } catch (error) {
    console.warn('Could not clean .next directory:', error?.message || error);
  }
}

async function ensureDevDirectories() {
  const devStaticDir = path.join(process.cwd(), '.next', 'static', 'development');
  const devAppPageDir = path.join(process.cwd(), '.next', 'server', 'app', 'page');
  try {
    await fs.mkdir(devStaticDir, { recursive: true });
    await fs.mkdir(devAppPageDir, { recursive: true });
  } catch (error) {
    console.warn('Could not pre-create dev manifest directories:', error?.message || error);
  }
}

async function main() {
  await removeNextBuildArtifacts();
  await ensureDevDirectories();
}

main().catch((error) => {
  console.error('prepare-dev failed:', error);
  process.exitCode = 1;
});
