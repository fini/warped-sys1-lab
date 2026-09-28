<script lang="ts">
	import Bar from './Bar.svelte';
	import { show } from '$lib/format';
	import type { ScoreAnswer } from '$lib/types';

	let { answer }: { answer: ScoreAnswer } = $props();

	const levels = $derived(
		Object.keys(answer.probabilities)
			.map(Number)
			.sort((a, b) => a - b)
	);
	const max = $derived(Math.max(1, levels.at(-1) ?? 1));
	const top = $derived(
		levels.reduce((best, l) => (answer.probabilities[l] > answer.probabilities[best] ? l : best), levels[0])
	);
</script>

<div class="verdict">
	<span class="big glow">{answer.score.toFixed(2)}</span>
	<span class="muted">/ {max} · confidence {answer.confidence.toFixed(2)}</span>
</div>

<div class="scale" aria-hidden="true">
	{#each levels as l (l)}
		<span class="tick" style:left="{(l / max) * 100}%">{l}</span>
	{/each}
	<span class="marker" style:left="{(answer.score / max) * 100}%"></span>
</div>

{#each levels as l (l)}
	<Bar label="{l} · {show(answer.legend[l])}" value={answer.probabilities[l]} highlight={l === top} hint={show(answer.legend[l])} />
{/each}

<style>
	.verdict {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 4px;
	}
	.big {
		font-size: 15px;
	}
	.scale {
		position: relative;
		height: 26px;
		margin: 0 10px 10px;
		border-bottom: 1px solid var(--line-strong);
	}
	.tick {
		position: absolute;
		bottom: -1px;
		transform: translateX(-50%);
		font-size: 10px;
		color: var(--muted);
		border-left: 1px solid var(--line-strong);
		padding-left: 3px;
		height: 12px;
		line-height: 10px;
	}
	.marker {
		position: absolute;
		bottom: -5px;
		width: 10px;
		height: 10px;
		transform: translateX(-50%) rotate(45deg);
		background: var(--green);
		box-shadow: 0 0 10px var(--green);
		transition: left 0.5s ease-out;
	}
</style>
