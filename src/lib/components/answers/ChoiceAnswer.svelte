<script lang="ts">
	import Bar from './Bar.svelte';
	import { show } from '$lib/format';
	import type { ChoiceAnswer, ChoiceQuestion } from '$lib/types';

	let { answer, question }: { answer: ChoiceAnswer; question?: ChoiceQuestion } = $props();

	const rows = $derived(Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]));
</script>

<div class="verdict">
	<span class="big glow">{answer.choice}</span>
	<span class="muted">confidence {answer.confidence.toFixed(2)}</span>
</div>
{#each rows as [label, p] (label)}
	<Bar {label} value={p} highlight={label === answer.choice} hint={show(question?.criteria?.[label])} />
{/each}

<style>
	.verdict {
		display: flex;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 4px;
		flex-wrap: wrap;
	}
	.big {
		font-size: 15px;
		letter-spacing: 0.05em;
		word-break: break-word;
	}
</style>
