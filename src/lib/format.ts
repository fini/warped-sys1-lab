import type { Json } from './types';

export const pct = (p: number) => `${(p * 100).toFixed(p >= 0.995 || p < 0.005 ? 0 : 1)}%`;

/** Render instructions/criteria (string or structured JSON) as display text. */
export const show = (v: Json | undefined): string =>
	v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);

/** Locate a JSON.parse error as 1-based line/column when the engine reports a position. */
export function parseJson(text: string):
	| { ok: true; value: unknown }
	| { ok: false; message: string; line?: number; column?: number } {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch (e) {
		const message = (e as Error).message;
		const lc = /line (\d+) column (\d+)/.exec(message);
		if (lc) return { ok: false, message, line: +lc[1], column: +lc[2] };
		const pos = /position (\d+)/.exec(message);
		if (pos) {
			const before = text.slice(0, +pos[1]);
			const line = before.split('\n').length;
			return { ok: false, message, line, column: +pos[1] - before.lastIndexOf('\n') };
		}
		return { ok: false, message };
	}
}
