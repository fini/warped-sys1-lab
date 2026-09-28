/**
 * Two kinds of substitution, applied just before a run:
 * - `#{name}` file variables, defined in the experiment's own `vars` (write a repeated text once);
 * - `${name}` inputs, filled from an input set (text pasted per run).
 * Vars are expanded first, so a var may contain `${input}` placeholders.
 * Framework-free so the browser, the server and the CLI share it.
 */
import type { Experiment, InputValues } from './types';

const PLACEHOLDER_RE = /\$\{([A-Za-z_][\w-]*)\}/g;
const VAR_RE = /#\{([A-Za-z_][\w-]*)\}/g;

/** Only the parts sent to the API are templated; `name`/`description` stay literal. */
const TEMPLATED = ['state', 'questions', 'cases'] as const;

function mapStrings(v: unknown, fn: (s: string) => string): unknown {
	if (typeof v === 'string') return fn(v);
	if (Array.isArray(v)) return v.map((x) => mapStrings(x, fn));
	if (v && typeof v === 'object') {
		return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, fn)]));
	}
	return v;
}

const varsOf = (exp: unknown): Record<string, unknown> => {
	const v = (exp as { vars?: unknown } | null)?.vars;
	return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};

/** `#{name}` references to vars that are not defined (or not strings), in order of first appearance. */
export function unknownVars(exp: unknown): string[] {
	if (!exp || typeof exp !== 'object') return [];
	const vars = varsOf(exp);
	const names = new Set<string>();
	for (const key of TEMPLATED) {
		mapStrings((exp as Record<string, unknown>)[key], (s) => {
			for (const m of s.matchAll(VAR_RE)) if (typeof vars[m[1]] !== 'string') names.add(m[1]);
			return s;
		});
	}
	return [...names];
}

/** Replace every `#{name}` with its value from `vars`. Unknown names are left as-is. */
export function expandVars<T>(exp: T): T {
	if (!exp || typeof exp !== 'object') return exp;
	const vars = varsOf(exp);
	if (!Object.keys(vars).length) return exp;
	const out: Record<string, unknown> = { ...(exp as Record<string, unknown>) };
	for (const key of TEMPLATED) {
		if (out[key] !== undefined) {
			out[key] = mapStrings(out[key], (s) =>
				s.replace(VAR_RE, (m, n: string) => (typeof vars[n] === 'string' ? (vars[n] as string) : m))
			);
		}
	}
	return out as T;
}

/** Placeholder names used by an experiment (after var expansion), in order of first appearance. */
export function findPlaceholders(template: unknown): string[] {
	const exp = expandVars(template);
	if (!exp || typeof exp !== 'object') return [];
	const names = new Set<string>();
	for (const key of TEMPLATED) {
		mapStrings((exp as Record<string, unknown>)[key], (s) => {
			for (const m of s.matchAll(PLACEHOLDER_RE)) names.add(m[1]);
			return s;
		});
	}
	return [...names];
}

/** Placeholders that have no (non-blank) value. */
export const missingInputs = (exp: unknown, values: InputValues): string[] =>
	findPlaceholders(exp).filter((n) => !values[n]?.trim());

/** Keep only the values an experiment actually uses. */
export const usedInputs = (exp: unknown, values: InputValues): InputValues =>
	Object.fromEntries(findPlaceholders(exp).map((n) => [n, values[n] ?? '']));

/** Expand vars, then replace every `${name}` with its value. Unknown names are left as-is. */
export function applyInputs(template: Experiment, values: InputValues): Experiment {
	const out: Record<string, unknown> = { ...expandVars(template) };
	for (const key of TEMPLATED) {
		if (out[key] !== undefined) {
			out[key] = mapStrings(out[key], (s) => s.replace(PLACEHOLDER_RE, (m, n: string) => values[n] ?? m));
		}
	}
	return out as unknown as Experiment;
}
