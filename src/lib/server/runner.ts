/**
 * Runs experiments against Jev via the TypeSafe SDK.
 * Framework-free so the CLI script can reuse it.
 */
import { APIError, TypeSafeClient, TypeSafeError, type EntryType, type Questions } from '@typesafe-ai/sdk';
import { applyInputs, findPlaceholders, missingInputs, usedInputs } from '../inputs';
import { validateExperiment } from '../validate';
import type { CaseRun, Experiment, ExperimentCase, ModelInfo, RunError, RunInputs, RunResult } from '../types';

const CONCURRENCY = 4;

export class ConfigError extends Error {}

export function createClient(apiKey: string | undefined, baseURL?: string): TypeSafeClient {
	if (!apiKey?.trim()) throw new ConfigError('JEV_API_KEY is not set. Add it to .env in the project root.');
	return new TypeSafeClient({ apiKey: apiKey.trim(), baseURL: baseURL || undefined, timeout: 30_000 });
}

const toRunError = (err: unknown): RunError => {
	if (err instanceof APIError) {
		return { message: err.message, status: err.status, requestId: err.requestId, body: err.body };
	}
	if (err instanceof TypeSafeError || err instanceof Error) return { message: `${err.name}: ${err.message}` };
	return { message: String(err) };
};

/** Map over items with at most `limit` in flight, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i], i);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}

async function runCase(client: TypeSafeClient, exp: Experiment, c: ExperimentCase, label: string): Promise<CaseRun> {
	const started = performance.now();
	try {
		const res = await client.systemOne({
			state: c.state as EntryType,
			questions: exp.questions as unknown as Questions,
			...(exp.model ? { model: exp.model } : {})
		});
		return {
			case: label,
			model: res.model,
			answers: res.answers as CaseRun['answers'],
			usage: res.usage,
			latencyMs: Math.round(performance.now() - started)
		};
	} catch (err) {
		return { case: label, latencyMs: Math.round(performance.now() - started), error: toRunError(err) };
	}
}

const runId = (d: Date) => d.toISOString().replace(/[:.]/g, '-');

/**
 * Run every case of an experiment (or its single `state`), with `${name}` placeholders filled from `inputs`.
 * Invalid shapes and empty inputs throw before any API call.
 */
export async function runExperiment(
	client: TypeSafeClient,
	template: Experiment,
	meta: { project?: string; experiment?: string } = {},
	inputs?: RunInputs
): Promise<RunResult> {
	const values = inputs?.values ?? {};
	const missing = missingInputs(template, values);
	if (missing.length) throw new TypeSafeError(missing.map((n) => `Input \`${n}\` is empty.`).join('\n'));
	const exp = applyInputs(template, values);
	const problems = validateExperiment(exp);
	if (problems.length) throw new TypeSafeError(problems.join('\n'));
	const used = findPlaceholders(template).length
		? { ...(inputs?.set ? { set: inputs.set } : {}), values: usedInputs(template, values) }
		: undefined;

	const cases: ExperimentCase[] = exp.cases?.length ? exp.cases : [{ name: 'default', state: exp.state ?? null }];
	const startedAt = new Date();
	const t0 = performance.now();
	const runs = await mapLimit(cases, CONCURRENCY, (c, i) => runCase(client, exp, c, c.name ?? `case ${i + 1}`));

	return {
		id: runId(startedAt),
		...meta,
		startedAt: startedAt.toISOString(),
		durationMs: Math.round(performance.now() - t0),
		input: template,
		...(used ? { inputs: used } : {}),
		runs
	};
}

export async function listModels(client: TypeSafeClient): Promise<ModelInfo[]> {
	return (await client.models.list()).map((m) => ({ ...m }));
}
