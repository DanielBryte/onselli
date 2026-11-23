// Drizzle Kit's bundled tsx runner calls os.userInfo() on Windows when
// process.geteuid is unavailable. In restricted Windows runtimes that native
// lookup can fail even though the process can access the configured temp path.
// Supplying a stable, non-privileged cache suffix avoids that unrelated lookup.
if (process.platform === 'win32' && typeof process.geteuid !== 'function') {
  process.geteuid = () => 0;
}

process.argv = [process.execPath, 'drizzle-kit', ...process.argv.slice(2)];
const path = require('node:path');
require(path.join(path.dirname(require.resolve('drizzle-kit')), 'bin.cjs'));
