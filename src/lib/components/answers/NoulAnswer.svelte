<script lang="ts">
	import { pct } from '$lib/format';
	import type { NoulAnswer } from '$lib/types';

	let { answer }: { answer: NoulAnswer } = $props();
	const yes = $derived(answer.noul >= 0.5);
</script>

<div class="verdict">
	<span class="big" class:yes class:no={!yes}>{yes ? 'YES' : 'NO'}</span>
	<div class="split" aria-label="yes {pct(answer.noul)}, no {pct(1 - answer.noul)}">
		<span class="y" style:width="{answer.noul * 100}%">{answer.noul > 0.12 ? `YES ${pct(answer.noul)}` : ''}</span>
		<span class="n">{answer.noul < 0.88 ? `NO ${pct(1 - answer.noul)}` : ''}</span>
	</div>
	<span class="muted p" title="p(yes)">{answer.noul.toFixed(3)}</span>
</div>

<style>
	.verdict {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.big {
		font-size: 14px;
		letter-spacing: 0.15em;
		width: 3.2em;
	}
	.p {
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.yes {
		color: var(--green);
		text-shadow: var(--glow);
	}
	.no {
		color: var(--amber);
		text-shadow: 0 0 6px rgba(255, 204, 51, 0.5);
	}
	.split {
		flex: 1;
		display: flex;
		height: 16px;
		border: 1px solid var(--line-strong);
		font-size: 10px;
		line-height: 14px;
		overflow: hidden;
	}
	.y {
		background: rgba(0, 255, 65, 0.55);
		color: #000;
		padding-left: 6px;
		white-space: nowrap;
		transition: width 0.5s ease-out;
	}
	.n {
		flex: 1;
		background: rgba(255, 204, 51, 0.12);
		color: var(--amber);
		text-align: right;
		padding-right: 6px;
		white-space: nowrap;
	}
</style>
