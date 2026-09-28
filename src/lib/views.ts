/**
 * `views`: group answers by id pattern / type into one ranked list.
 * Framework-free so the UI and the CLI share it.
 */
import { show } from './format';
import type { Answer, ResultView } from './types';

export interface ViewRow {
	id: string;
	label: string;
	/** 0–1, used for ranking and the bar. */
	value: number;
	/** Main figure: p(yes), the choice, or the expected score. */
	text: string;
	/** Most likely score level, e.g. "Core" (score only). */
	level?: string;
	confidence?: number;
}

const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** `*Score` → /^(.*)Score$/ */
const patternRe = (match: string) => new RegExp(`^${match.split('*').map(escape).join('(.*)')}$`);

/** Legend text up to its first ":" ("Core: the article's…" → "Core"), when that is short. */
const shortLevel = (legend: unknown, level: string) => {
	const s = show(legend as never);
	const head = s.split(':')[0].trim();
	return head && head.length <= 20 ? head : level;
};

function toRow(id: string, label: string, a: Answer): ViewRow {
	if (a.type === 'noul') return { id, label, value: a.noul, text: a.noul.toFixed(2) };
	if (a.type === 'choice') return { id, label, value: a.confidence, text: a.choice, confidence: a.confidence };
	const levels = Object.keys(a.probabilities).map(Number);
	const max = Math.max(1, ...levels);
	const top = levels.reduce((b, l) => (a.probabilities[l] > a.probabilities[b] ? l : b), levels[0]);
	return {
		id,
		label,
		value: a.score / max,
		text: `${a.score.toFixed(2)}/${max}`,
		level: shortLevel(a.legend[top], String(top)),
		confidence: a.confidence
	};
}

/** Rows for one view, best first. */
export function viewRows(view: ResultView, answers: Record<string, Answer>): ViewRow[] {
	const re = patternRe(view.match || '*');
	const rows: ViewRow[] = [];
	for (const [id, a] of Object.entries(answers)) {
		const m = re.exec(id);
		if (!m || (view.type && a.type !== view.type)) continue;
		rows.push(toRow(id, m.slice(1).join('') || id, a));
	}
	return rows.sort((x, y) => y.value - x.value);
}
