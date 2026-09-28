import { unknownVars } from './inputs';
import type { Experiment } from './types';

/** Project and experiment names: filesystem-safe, no leading dot, no path separators. */
export const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

export const isValidName = (name: unknown): name is string =>
	typeof name === 'string' && NAME_RE.test(name) && !name.includes('..');

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '';

/**
 * Check an experiment's shape against the API limits.
 * Returns a list of human-readable problems; empty means runnable.
 */
export function validateExperiment(exp: unknown): string[] {
	const problems: string[] = [];
	if (!isObject(exp)) return ['Experiment must be a JSON object.'];

	if (exp.model !== undefined && typeof exp.model !== 'string') problems.push('`model` must be a string.');

	const { questions, cases } = exp;
	if (!isObject(questions) || Object.keys(questions).length === 0) {
		problems.push('`questions` must be an object with at least one question.');
	} else {
		for (const [id, q] of Object.entries(questions)) {
			const at = `questions.${id}`;
			if (!isObject(q)) {
				problems.push(`${at} must be an object.`);
				continue;
			}
			if (!hasValue(q.instructions)) problems.push(`${at}.instructions is required.`);
			switch (q.type) {
				case 'noul':
					if (q.criteria != null && !isObject(q.criteria))
						problems.push(`${at}.criteria must be { "true": …, "false": … } or omitted.`);
					break;
				case 'choice': {
					if (!isObject(q.criteria)) {
						problems.push(`${at}.criteria must be an object of label → description|null.`);
						break;
					}
					const n = Object.keys(q.criteria).length;
					if (n < 2) problems.push(`${at}.criteria needs at least 2 options.`);
					if (n > 255) problems.push(`${at}.criteria has ${n} options; max is 255.`);
					break;
				}
				case 'score': {
					if (!Array.isArray(q.criteria)) {
						problems.push(`${at}.criteria must be an array of level descriptions.`);
						break;
					}
					const n = q.criteria.length;
					if (n < 2 || n > 10) problems.push(`${at}.criteria has ${n} levels; must be 2–10.`);
					break;
				}
				default:
					problems.push(`${at}.type must be "noul", "choice" or "score".`);
			}
		}
	}

	if (exp.vars !== undefined) {
		if (!isObject(exp.vars)) problems.push('`vars` must be an object of name → text.');
		else
			for (const [k, v] of Object.entries(exp.vars))
				if (typeof v !== 'string') problems.push(`vars.${k} must be a string.`);
	}
	for (const n of unknownVars(exp)) problems.push(`\`#{${n}}\` is not defined in \`vars\`.`);

	if (exp.views !== undefined) {
		if (!Array.isArray(exp.views)) problems.push('`views` must be an array.');
		else
			exp.views.forEach((v, i) => {
				const at = `views[${i}]`;
				if (!isObject(v)) return problems.push(`${at} must be an object.`);
				if (typeof v.title !== 'string' || !v.title) problems.push(`${at}.title is required.`);
				if (v.match !== undefined && typeof v.match !== 'string') problems.push(`${at}.match must be a string.`);
				if (v.type !== undefined && !['noul', 'choice', 'score'].includes(v.type as string))
					problems.push(`${at}.type must be "noul", "choice" or "score".`);
			});
	}

	if (cases !== undefined) {
		if (!Array.isArray(cases) || cases.length === 0) {
			problems.push('`cases` must be a non-empty array when present.');
		} else {
			cases.forEach((c, i) => {
				if (!isObject(c) || !hasValue(c.state)) problems.push(`cases[${i}].state is required.`);
			});
		}
	} else if (!hasValue(exp.state)) {
		problems.push('`state` is required (or provide `cases`).');
	}

	return problems;
}

export const asExperiment = (exp: unknown) => exp as Experiment;

/** Template for a new experiment: one question of each type. */
export const newExperimentTemplate = (name: string): Experiment => ({
	name,
	description: 'Describe what this experiment tests.',
	model: 'jev-latest',
	state: {
		message: 'Hi, I was charged twice for my subscription this month. Please refund one of them.'
	},
	questions: {
		isBilling: {
			type: 'noul',
			instructions: 'Is `message` about billing or payments?'
		},
		tone: {
			type: 'choice',
			instructions: 'What is the tone of `message`?',
			criteria: { calm: null, frustrated: null, angry: null }
		},
		urgency: {
			type: 'score',
			instructions: 'How urgently does `message` need a response?',
			criteria: ['Can wait a week or more', 'Should be handled this week', 'Should be handled today', 'Needs attention right now']
		}
	}
});
