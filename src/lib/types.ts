/** Shared types for experiments, runs, and the project tree. */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface NoulQuestion {
	type: 'noul';
	instructions: Json;
	criteria?: { true?: Json; false?: Json } | null;
}

export interface ChoiceQuestion {
	type: 'choice';
	instructions: Json;
	criteria: Record<string, Json>;
}

export interface ScoreQuestion {
	type: 'score';
	instructions: Json;
	criteria: Json[];
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export interface ExperimentCase {
	name?: string;
	state: Json;
}

/**
 * A summary shown above the answer cards: the matching questions as one ranked list.
 * `match` is an id pattern where `*` matches anything (e.g. `*Score`); the `*` part becomes the row label.
 */
export interface ResultView {
	title: string;
	match?: string;
	type?: Question['type'];
}

/** An experiment file. Only `state`, `questions` and `model` are sent to the API. */
export interface Experiment {
	name?: string;
	description?: string;
	model?: string;
	state?: Json;
	questions: Record<string, Question>;
	cases?: ExperimentCase[];
	/** `#{name}` file variables, expanded in `state`, `questions` and `cases` before a run. */
	vars?: Record<string, string>;
	/** Display only. */
	views?: ResultView[];
}

export interface NoulAnswer {
	type: 'noul';
	noul: number;
}

export interface ChoiceAnswer {
	type: 'choice';
	choice: string;
	confidence: number;
	probabilities: Record<string, number>;
}

export interface ScoreAnswer {
	type: 'score';
	score: number;
	confidence: number;
	legend: Record<string, Json>;
	probabilities: Record<string, number>;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface RunError {
	message: string;
	status?: number;
	requestId?: string;
	body?: unknown;
}

/** Outcome of one API call (one case). */
export interface CaseRun {
	case: string;
	model?: string;
	answers?: Record<string, Answer>;
	usage?: { input_tokens: number; output_tokens: number };
	latencyMs: number;
	error?: RunError;
}

/** Values for `${name}` placeholders, keyed by placeholder name. */
export type InputValues = Record<string, string>;

/** The inputs a run was made with: the saved set it came from (if any) and the values sent. */
export interface RunInputs {
	set?: string;
	values: InputValues;
}

export interface RunResult {
	id: string;
	project?: string;
	experiment?: string;
	startedAt: string;
	durationMs: number;
	/** The experiment as written, placeholders included. */
	input: Experiment;
	inputs?: RunInputs;
	runs: CaseRun[];
}

export interface ProjectNode {
	project: string;
	experiments: string[];
	/** Lives in `experiments_private/` (gitignored). */
	private?: boolean;
}

export interface ModelInfo {
	name: string;
	description: string;
	release_date: string;
}

export interface ResultSummary {
	id: string;
	startedAt: string;
	durationMs: number;
	cases: number;
	errors: number;
	inputSet?: string;
}
