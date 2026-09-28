/** Browser-side helpers for the lab's JSON API. */
import type { InputValues, ModelInfo, ProjectNode, ResultSummary, RunInputs, RunResult } from './types';

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly body?: unknown
	) {
		super(message);
	}
}

const enc = encodeURIComponent;

async function call<T>(method: string, url: string, body?: unknown, raw = false): Promise<T> {
	const res = await fetch(url, {
		method,
		headers: body === undefined ? {} : { 'content-type': 'application/json' },
		body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
	});
	const textBody = await res.text();
	let parsed: unknown = textBody;
	try {
		parsed = textBody ? JSON.parse(textBody) : undefined;
	} catch {
		// non-JSON body
	}
	if (!res.ok) {
		const msg = (parsed as { error?: string })?.error ?? `${res.status} ${res.statusText}`;
		throw new ApiError(msg, res.status, parsed);
	}
	return (raw ? textBody : parsed) as T;
}

const exp = (p: string, n: string) => `/api/experiments/${enc(p)}/${enc(n)}`;
const inp = (p: string, s: string) => `/api/inputs/${enc(p)}/${enc(s)}`;

export const api = {
	tree: () => call<ProjectNode[]>('GET', '/api/tree'),
	models: () => call<ModelInfo[]>('GET', '/api/models'),

	createProject: (project: string, isPrivate = false) =>
		call('POST', '/api/projects', { project, private: isPrivate }),
	renameProject: (project: string, toProject: string) =>
		call('PATCH', `/api/projects/${enc(project)}`, { toProject }),
	deleteProject: (project: string, force = false) =>
		call('DELETE', `/api/projects/${enc(project)}${force ? '?force=1' : ''}`),

	readExperiment: (p: string, n: string) => call<string>('GET', exp(p, n), undefined, true),
	saveExperiment: (p: string, n: string, content: string, create = false) =>
		call('PUT', exp(p, n) + (create ? '?create=1' : ''), content),
	deleteExperiment: (p: string, n: string) => call('DELETE', exp(p, n)),
	duplicateExperiment: (p: string, n: string, toProject: string, toName: string) =>
		call('POST', exp(p, n) + '/duplicate', { toProject, toName }),
	renameExperiment: (p: string, n: string, toProject: string, toName: string) =>
		call('POST', exp(p, n) + '/rename', { toProject, toName }),

	inputSets: (p: string) => call<string[]>('GET', `/api/inputs/${enc(p)}`),
	readInputSet: (p: string, s: string) => call<InputValues>('GET', inp(p, s)),
	saveInputSet: (p: string, s: string, values: InputValues, create = false) =>
		call('PUT', inp(p, s) + (create ? '?create=1' : ''), values),
	renameInputSet: (p: string, s: string, toSet: string) => call('POST', inp(p, s) + '/rename', { toSet }),
	deleteInputSet: (p: string, s: string) => call('DELETE', inp(p, s)),

	run: (experiment: unknown, project?: string, name?: string, inputs?: RunInputs) =>
		call<RunResult>('POST', '/api/run', { experiment, project, name, inputs }),
	results: (p: string, n: string) => call<ResultSummary[]>('GET', `/api/results/${enc(p)}/${enc(n)}`),
	result: (p: string, n: string, id: string) =>
		call<RunResult>('GET', `/api/results/${enc(p)}/${enc(n)}/${enc(id)}`)
};
