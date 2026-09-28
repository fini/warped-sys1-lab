/**
 * Filesystem storage for experiments and run results.
 *
 * experiments/<project>/<name>.json
 * experiments/<project>/_inputs/<set>.json   (values for `${name}` placeholders, shared by the project)
 * experiments_private/<project>/…             (same layout, gitignored; never copied to or from experiments/)
 * results/<project>/<name>/<run-id>.json
 *
 * Project names are unique across both roots, so every other path is resolved by name alone.
 *
 * Imports only `node:` modules so the CLI script can reuse it outside SvelteKit.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isValidName } from '../validate';
import type { Experiment, InputValues, ProjectNode, ResultSummary, RunResult } from '../types';

const ROOT = process.env.LAB_ROOT ?? process.cwd();
export const EXPERIMENTS_DIR = path.resolve(ROOT, 'experiments');
export const PRIVATE_DIR = path.resolve(ROOT, 'experiments_private');
export const RESULTS_DIR = path.resolve(ROOT, 'results');

export class StoreError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

const assertName = (kind: string, name: unknown): string => {
	if (!isValidName(name)) {
		throw new StoreError(
			`Invalid ${kind} name "${String(name)}". Use letters, digits, ".", "_" or "-" (max 64, no leading dot).`,
			400
		);
	}
	return name;
};

/** Resolve a path under `base`, refusing anything that escapes it. */
const inside = (base: string, ...parts: string[]): string => {
	const p = path.resolve(base, ...parts);
	if (p !== base && !p.startsWith(base + path.sep)) throw new StoreError('Path escapes storage root.', 400);
	return p;
};

const exists = async (p: string) => {
	try {
		await stat(p);
		return true;
	} catch {
		return false;
	}
};

/** The root a project lives in: private if it exists there, public otherwise (also for new names). */
const rootOf = (project: string) =>
	existsSync(inside(PRIVATE_DIR, assertName('project', project))) ? PRIVATE_DIR : EXPERIMENTS_DIR;

export const isPrivateProject = (project: string) => rootOf(project) === PRIVATE_DIR;

const projectDir = (project: string) => inside(rootOf(project), assertName('project', project));

/** Refuse to copy or move experiments across the private/public line; that is a manual step. */
const assertSameRoot = (project: string, toProject: string) => {
	if (isPrivateProject(project) !== isPrivateProject(toProject)) {
		throw new StoreError('Copy between private and public projects manually (experiments_private/ ↔ experiments/).', 400);
	}
};
const experimentFile = (project: string, name: string) =>
	inside(projectDir(project), `${assertName('experiment', name)}.json`);

async function projectsIn(root: string): Promise<string[]> {
	if (!(await exists(root))) return [];
	const entries = await readdir(root, { withFileTypes: true });
	return entries.filter((e) => e.isDirectory() && isValidName(e.name)).map((e) => e.name);
}

export async function listTree(): Promise<ProjectNode[]> {
	await mkdir(EXPERIMENTS_DIR, { recursive: true });
	const priv = await projectsIn(PRIVATE_DIR);
	const pub = (await projectsIn(EXPERIMENTS_DIR)).filter((p) => {
		if (!priv.includes(p)) return true;
		console.warn(`[store] project "${p}" exists in both experiments/ and experiments_private/; showing the private one.`);
		return false;
	});
	const tree = await Promise.all(
		[...priv.map((p) => [p, PRIVATE_DIR] as const), ...pub.map((p) => [p, EXPERIMENTS_DIR] as const)].map(
			async ([project, root]) => {
				const files = await readdir(path.join(root, project));
				const experiments = files
					.filter((f) => f.endsWith('.json'))
					.map((f) => f.slice(0, -5))
					.filter(isValidName)
					.sort((a, b) => a.localeCompare(b));
				return { project, experiments, ...(root === PRIVATE_DIR ? { private: true } : {}) };
			}
		)
	);
	return tree.sort((a, b) => a.project.localeCompare(b.project));
}

/** Create an empty project folder in `experiments/`, or in `experiments_private/` when `isPrivate`. */
export async function createProject(project: string, { isPrivate = false } = {}): Promise<void> {
	if (await exists(projectDir(project))) throw new StoreError(`Project "${project}" already exists.`, 409);
	await mkdir(inside(isPrivate ? PRIVATE_DIR : EXPERIMENTS_DIR, project), { recursive: true });
}

export async function renameProject(project: string, toProject: string): Promise<void> {
	const from = projectDir(project);
	if (!(await exists(from))) throw new StoreError(`Project "${project}" not found.`, 404);
	if (await exists(projectDir(toProject))) throw new StoreError(`Project "${toProject}" already exists.`, 409);
	const to = inside(rootOf(project), assertName('project', toProject));
	await rename(from, to);
	const resFrom = inside(RESULTS_DIR, project);
	if (await exists(resFrom)) await rename(resFrom, inside(RESULTS_DIR, toProject));
}

/** Delete a project folder. Refuses unless empty, or `force` is set. */
export async function deleteProject(project: string, force = false): Promise<void> {
	const dir = projectDir(project);
	if (!(await exists(dir))) throw new StoreError(`Project "${project}" not found.`, 404);
	const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
	const sets = await listInputSets(project);
	if ((files.length > 0 || sets.length > 0) && !force) {
		throw new StoreError(`Project "${project}" still has ${files.length} experiment(s) and ${sets.length} input set(s).`, 409);
	}
	await rm(dir, { recursive: true, force: true });
}

export async function readExperimentRaw(project: string, name: string): Promise<string> {
	const file = experimentFile(project, name);
	try {
		return await readFile(file, 'utf8');
	} catch {
		throw new StoreError(`Experiment "${project}/${name}" not found.`, 404);
	}
}

export async function readExperiment(project: string, name: string): Promise<Experiment> {
	const raw = await readExperimentRaw(project, name);
	try {
		return JSON.parse(raw) as Experiment;
	} catch (e) {
		throw new StoreError(`Experiment "${project}/${name}" is not valid JSON: ${(e as Error).message}`, 422);
	}
}

/** Save raw JSON text. It must parse; shape problems are allowed so drafts can be saved. */
export async function writeExperiment(
	project: string,
	name: string,
	content: string,
	{ overwrite = true } = {}
): Promise<void> {
	const file = experimentFile(project, name);
	try {
		JSON.parse(content);
	} catch (e) {
		throw new StoreError(`Not valid JSON: ${(e as Error).message}`, 422);
	}
	if (!(await exists(projectDir(project)))) throw new StoreError(`Project "${project}" not found.`, 404);
	if (!overwrite && (await exists(file))) throw new StoreError(`Experiment "${project}/${name}" already exists.`, 409);
	await writeFile(file, content.endsWith('\n') ? content : content + '\n', 'utf8');
}

export async function duplicateExperiment(project: string, name: string, toProject: string, toName: string) {
	assertSameRoot(project, toProject);
	const raw = await readExperimentRaw(project, name);
	let content = raw;
	try {
		const exp = JSON.parse(raw);
		if (exp && typeof exp === 'object' && typeof exp.name === 'string') exp.name = `${exp.name} (copy)`;
		content = JSON.stringify(exp, null, 2);
	} catch {
		// keep the raw text for drafts that don't parse
	}
	await writeExperiment(toProject, toName, content, { overwrite: false });
}

export async function renameExperiment(project: string, name: string, toProject: string, toName: string) {
	const from = experimentFile(project, name);
	const to = experimentFile(toProject, toName);
	if (!(await exists(from))) throw new StoreError(`Experiment "${project}/${name}" not found.`, 404);
	if (!(await exists(projectDir(toProject)))) throw new StoreError(`Project "${toProject}" not found.`, 404);
	assertSameRoot(project, toProject);
	if (await exists(to)) throw new StoreError(`Experiment "${toProject}/${toName}" already exists.`, 409);
	await rename(from, to);
	const resFrom = inside(RESULTS_DIR, project, name);
	if (await exists(resFrom)) {
		await mkdir(inside(RESULTS_DIR, toProject), { recursive: true });
		await rename(resFrom, inside(RESULTS_DIR, toProject, toName));
	}
}

export async function deleteExperiment(project: string, name: string): Promise<void> {
	const file = experimentFile(project, name);
	if (!(await exists(file))) throw new StoreError(`Experiment "${project}/${name}" not found.`, 404);
	await rm(file);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const resultsDir = (project: string, name: string) =>
	inside(RESULTS_DIR, assertName('project', project), assertName('experiment', name));

export async function saveResult(result: RunResult): Promise<void> {
	if (!result.project || !result.experiment) return;
	const dir = resultsDir(result.project, result.experiment);
	await mkdir(dir, { recursive: true });
	await writeFile(inside(dir, `${result.id}.json`), JSON.stringify(result, null, 2) + '\n', 'utf8');
}

export async function listResults(project: string, name: string, limit = 50): Promise<ResultSummary[]> {
	const dir = resultsDir(project, name);
	if (!(await exists(dir))) return [];
	const files = (await readdir(dir))
		.filter((f) => f.endsWith('.json'))
		.sort()
		.reverse()
		.slice(0, limit);
	const summaries = await Promise.all(
		files.map(async (f): Promise<ResultSummary | null> => {
			try {
				const r = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as RunResult;
				return {
					id: r.id,
					startedAt: r.startedAt,
					durationMs: r.durationMs,
					cases: r.runs.length,
					errors: r.runs.filter((x) => x.error).length,
					...(r.inputs?.set ? { inputSet: r.inputs.set } : {})
				};
			} catch {
				return null;
			}
		})
	);
	return summaries.filter((s): s is ResultSummary => s !== null);
}

export async function readResult(project: string, name: string, id: string): Promise<RunResult> {
	const file = inside(resultsDir(project, name), `${assertName('result', id)}.json`);
	try {
		return JSON.parse(await readFile(file, 'utf8')) as RunResult;
	} catch {
		throw new StoreError(`Result "${id}" not found.`, 404);
	}
}

// ---------------------------------------------------------------------------
// Input sets
// ---------------------------------------------------------------------------

/** `_` can't start a project or experiment name, so this folder never shows up in the tree. */
const INPUTS_FOLDER = '_inputs';

const inputsDir = (project: string) => inside(projectDir(project), INPUTS_FOLDER);
const inputFile = (project: string, set: string) => inside(inputsDir(project), `${assertName('input set', set)}.json`);

const asValues = (v: unknown): InputValues => {
	if (!v || typeof v !== 'object' || Array.isArray(v)) throw new StoreError('Input set must be an object of name → text.', 422);
	const out: InputValues = {};
	for (const [k, x] of Object.entries(v)) {
		if (typeof x !== 'string') throw new StoreError(`Input \`${k}\` must be a string.`, 422);
		out[k] = x;
	}
	return out;
};

export async function listInputSets(project: string): Promise<string[]> {
	const dir = inputsDir(project);
	if (!(await exists(dir))) return [];
	return (await readdir(dir))
		.filter((f) => f.endsWith('.json'))
		.map((f) => f.slice(0, -5))
		.filter(isValidName)
		.sort((a, b) => a.localeCompare(b));
}

export async function readInputSet(project: string, set: string): Promise<InputValues> {
	let raw: string;
	try {
		raw = await readFile(inputFile(project, set), 'utf8');
	} catch {
		throw new StoreError(`Input set "${project}/${set}" not found.`, 404);
	}
	try {
		return asValues(JSON.parse(raw));
	} catch (e) {
		if (e instanceof StoreError) throw e;
		throw new StoreError(`Input set "${project}/${set}" is not valid JSON: ${(e as Error).message}`, 422);
	}
}

export async function writeInputSet(project: string, set: string, values: unknown, { overwrite = true } = {}) {
	const file = inputFile(project, set);
	if (!(await exists(projectDir(project)))) throw new StoreError(`Project "${project}" not found.`, 404);
	if (!overwrite && (await exists(file))) throw new StoreError(`Input set "${project}/${set}" already exists.`, 409);
	await mkdir(inputsDir(project), { recursive: true });
	await writeFile(file, JSON.stringify(asValues(values), null, 2) + '\n', 'utf8');
}

export async function renameInputSet(project: string, set: string, toSet: string) {
	const from = inputFile(project, set);
	const to = inputFile(project, toSet);
	if (!(await exists(from))) throw new StoreError(`Input set "${project}/${set}" not found.`, 404);
	if (await exists(to)) throw new StoreError(`Input set "${project}/${toSet}" already exists.`, 409);
	await rename(from, to);
}

export async function deleteInputSet(project: string, set: string) {
	const file = inputFile(project, set);
	if (!(await exists(file))) throw new StoreError(`Input set "${project}/${set}" not found.`, 404);
	await rm(file);
}
