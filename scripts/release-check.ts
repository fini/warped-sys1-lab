/**
 * Runs before `npm version` (see "preversion" in package.json): refuse to cut a release
 * unless we are on master and not behind origin/master.
 */
import { execFileSync } from 'node:child_process';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const fail = (msg: string): never => {
	console.error(`\x1b[31mrelease: ${msg}\x1b[0m`);
	process.exit(1);
};

const branch = git('branch', '--show-current');
if (branch !== 'master') fail(`releases are cut from master (on "${branch}").`);

git('fetch', '--quiet', 'origin', 'master');
const behind = Number(git('rev-list', '--count', 'HEAD..origin/master'));
if (behind) fail(`master is ${behind} commit(s) behind origin/master; pull first.`);
