<script lang="ts">
	import NoulAnswer from './answers/NoulAnswer.svelte';
	import ChoiceAnswer from './answers/ChoiceAnswer.svelte';
	import ScoreAnswer from './answers/ScoreAnswer.svelte';
	import ViewSummary from './ViewSummary.svelte';
	import { show } from '$lib/format';
	import { viewRows } from '$lib/views';
	import { expandVars } from '$lib/inputs';
	import type { ChoiceQuestion, ResultSummary, RunResult } from '$lib/types';

	let {
		result,
		error,
		running,
		history,
		onpick
	}: {
		result: RunResult | null;
		error: string | null;
		running: boolean;
		history: ResultSummary[];
		onpick: (id: string) => void;
	} = $props();

	let raw = $state(false);
	let activeCase = $state(0);

	$effect(() => {
		result;
		activeCase = 0;
	});

	const run = $derived(result?.runs[activeCase]);
	/** Questions with `#{…}` vars expanded, for instructions and criteria hints. */
	const questions = $derived(result ? expandVars(result.input).questions : {});
	const totals = $derived.by(() => {
		if (!result) return null;
		const ok = result.runs.filter((r) => r.usage);
		return {
			in: ok.reduce((s, r) => s + r.usage!.input_tokens, 0),
			out: ok.reduce((s, r) => s + r.usage!.output_tokens, 0),
			errors: result.runs.length - ok.length
		};
	});

	const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' });
</script>

<div class="results">
	<header>
		<span class="glow">// OUTPUT</span>
		<span class="spacer"></span>
		{#if history.length}
			<select
				title="Run history"
				value={result?.id ?? ''}
				onchange={(e) => onpick((e.currentTarget as HTMLSelectElement).value)}
			>
				{#if result && !history.some((h) => h.id === result.id)}
					<option value={result.id}>unsaved run · {when(result.startedAt)}</option>
				{/if}
				{#each history as h (h.id)}
					<option value={h.id}>{when(h.startedAt)} · {h.cases} case{h.cases === 1 ? '' : 's'}{h.inputSet ? ` · ${h.inputSet}` : ''}{h.errors ? ` · ${h.errors} err` : ''}</option>
				{/each}
			</select>
		{/if}
		<button onclick={() => (raw = !raw)} disabled={!result}>{raw ? 'cards' : 'raw'}</button>
	</header>

	<div class="body">
		{#if running}
			<div class="status">
				<div class="spinner glow">WAKE UP, JEV…</div>
				<div class="muted">transmitting to the construct</div>
			</div>
		{:else if error}
			<div class="failure">
				<div class="title">SYSTEM FAILURE</div>
				<pre>{error}</pre>
			</div>
		{:else if !result}
			<div class="status muted">
				<div>&gt; no signal</div>
				<div>select an experiment and press RUN (Ctrl/⌘+Enter)</div>
			</div>
		{:else if raw}
			<pre class="raw">{JSON.stringify(result, null, 2)}</pre>
		{:else}
			<div class="summary">
				<span>{result.runs.length} case{result.runs.length === 1 ? '' : 's'}</span>
				<span>{result.durationMs} ms</span>
				{#if totals}<span>{totals.in}↓ {totals.out}↑ tok</span>{/if}
				{#if totals?.errors}<span class="err">{totals.errors} failed</span>{/if}
			</div>

			{#if result.runs.length > 1}
				<div class="cases">
					{#each result.runs as r, i}
						<button class:active={i === activeCase} class:bad={!!r.error} onclick={() => (activeCase = i)}>{r.case}</button>
					{/each}
				</div>
			{/if}

			{#if run?.error}
				<div class="failure">
					<div class="title">SYSTEM FAILURE{run.error.status ? ` · HTTP ${run.error.status}` : ''}</div>
					<pre>{run.error.message}</pre>
					{#if run.error.requestId}<div class="muted">request {run.error.requestId}</div>{/if}
					{#if run.error.body && typeof run.error.body === 'object'}
						<pre class="muted">{JSON.stringify(run.error.body, null, 2)}</pre>
					{/if}
				</div>
			{:else if run?.answers}
				{#each result.input.views ?? [] as v, i (i)}
					<ViewSummary title={v.title} rows={viewRows(v, run.answers)} />
				{/each}
				{#each Object.entries(run.answers) as [id, answer] (id)}
					{@const q = questions?.[id]}
					<section class="card">
						<div class="qhead">
							<span class="qid glow">{id}</span>
							<span class="qtype">{answer.type}</span>
						</div>
						{#if q?.instructions}
							<details class="instr">
								<summary>instructions</summary>
								<div class="muted">{show(q.instructions)}</div>
							</details>
						{/if}
						{#if answer.type === 'noul'}
							<NoulAnswer {answer} />
						{:else if answer.type === 'choice'}
							<ChoiceAnswer {answer} question={q as ChoiceQuestion | undefined} />
						{:else if answer.type === 'score'}
							<ScoreAnswer {answer} />
						{:else}
							<pre>{JSON.stringify(answer, null, 2)}</pre>
						{/if}
					</section>
				{/each}
				<footer class="muted">
					model {run.model} · {run.usage?.input_tokens ?? '?'} in / {run.usage?.output_tokens ?? '?'} out · {run.latencyMs} ms
				</footer>
			{/if}
		{/if}
	</div>
</div>

<style>
	.results {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px 8px;
		letter-spacing: 0.1em;
	}
	header select {
		max-width: 220px;
		font-size: 11px;
		padding: 3px 4px;
	}
	.spacer {
		flex: 1;
	}
	.body {
		flex: 1;
		overflow: auto;
		padding: 0 12px 16px;
	}
	.status {
		padding: 40px 8px;
		text-align: center;
		line-height: 1.8;
	}
	.spinner {
		font-size: 16px;
		letter-spacing: 0.2em;
		animation: flicker 0.9s steps(2) infinite;
	}
	@keyframes flicker {
		50% {
			opacity: 0.35;
		}
	}
	.summary {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		color: var(--muted);
		font-size: 11px;
		padding: 2px 0 10px;
		border-bottom: 1px dashed var(--line);
		margin-bottom: 10px;
	}
	.err {
		color: var(--red);
	}
	.cases {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 10px;
	}
	.cases button {
		text-transform: none;
		letter-spacing: normal;
		font-size: 11px;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cases button.active {
		background: rgba(0, 255, 65, 0.18);
		border-color: var(--green);
		text-shadow: var(--glow);
	}
	.cases button.bad {
		color: var(--red);
		border-color: rgba(255, 51, 85, 0.5);
	}
	.card {
		border: 1px solid var(--line);
		background: rgba(0, 20, 6, 0.55);
		padding: 6px 10px;
		margin-bottom: 6px;
	}
	.qhead {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 4px;
	}
	.qid {
		font-size: 13px;
		letter-spacing: 0.04em;
	}
	.qtype {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		border: 1px solid var(--line-strong);
		padding: 0 6px;
		color: var(--green-dim);
	}
	.instr {
		font-size: 11px;
		margin-bottom: 4px;
		line-height: 1.4;
	}
	.instr summary {
		cursor: pointer;
		color: var(--green-dim);
		width: fit-content;
		letter-spacing: 0.05em;
	}
	.instr summary:hover {
		color: var(--green);
	}
	.instr[open] summary {
		margin-bottom: 3px;
	}
	footer {
		font-size: 11px;
		padding-top: 4px;
	}
	.failure {
		border: 1px solid var(--red);
		background: rgba(255, 51, 85, 0.07);
		padding: 12px;
		color: #ffb3c0;
		box-shadow: 0 0 18px rgba(255, 51, 85, 0.15);
	}
	.failure .title {
		color: var(--red);
		letter-spacing: 0.2em;
		margin-bottom: 8px;
		text-shadow: 0 0 6px rgba(255, 51, 85, 0.7);
	}
	pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 12px;
	}
	.raw {
		color: var(--text);
		font-size: 12px;
	}
</style>
