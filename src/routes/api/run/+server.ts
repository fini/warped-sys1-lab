import { json } from '@sveltejs/kit';
import { TypeSafeError } from '@typesafe-ai/sdk';
import { handle, readBody } from '$lib/server/http';
import { getClient } from '$lib/server/jev';
import { runExperiment } from '$lib/server/runner';
import { saveResult } from '$lib/server/store';
import { isValidName } from '$lib/validate';
import type { Experiment, RunInputs } from '$lib/types';

/** Run the posted experiment (the editor's current contents, saved or not) with the posted input values. */
export const POST = ({ request }) =>
	handle(async () => {
		const { project, name, experiment, inputs } = await readBody(request);
		const meta =
			isValidName(project) && isValidName(name) ? { project, experiment: name } : {};
		try {
			const result = await runExperiment(getClient(), experiment as Experiment, meta, asInputs(inputs));
			await saveResult(result);
			return result;
		} catch (err) {
			if (err instanceof TypeSafeError) return json({ error: err.message }, { status: 422 });
			throw err;
		}
	});

const asInputs = (v: unknown): RunInputs | undefined => {
	if (!v || typeof v !== 'object') return undefined;
	const { set, values } = v as Record<string, unknown>;
	if (!values || typeof values !== 'object') return undefined;
	const strings = Object.entries(values).filter((e): e is [string, string] => typeof e[1] === 'string');
	return { ...(isValidName(set) ? { set } : {}), values: Object.fromEntries(strings) };
};
