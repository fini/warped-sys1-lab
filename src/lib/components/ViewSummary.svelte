<script lang="ts">
	import type { ViewRow } from '$lib/views';

	let { title, rows }: { title: string; rows: ViewRow[] } = $props();
</script>

<section class="view">
	<div class="head">
		<span class="glow">{title}</span>
		<span class="muted">{rows.length}</span>
	</div>
	{#each rows as r, i (r.id)}
		<div class="row" class:top={i === 0} title={r.confidence != null ? `${r.id} · confidence ${r.confidence.toFixed(2)}` : r.id}>
			<span class="label">{r.label}</span>
			<span class="track"><span class="fill" style:width="{Math.max(0, Math.min(1, r.value)) * 100}%"></span></span>
			<span class="val">{r.text}</span>
			{#if r.level !== undefined}<span class="level">{r.level}</span>{/if}
		</div>
	{:else}
		<div class="muted">no matching answers</div>
	{/each}
</section>

<style>
	.view {
		border: 1px solid var(--line-strong);
		background: rgba(0, 20, 6, 0.55);
		padding: 6px 10px;
		margin-bottom: 6px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 6px;
		font-size: 13px;
		letter-spacing: 0.04em;
	}
	.row {
		display: grid;
		grid-template-columns: minmax(80px, 32%) 1fr auto auto;
		align-items: center;
		gap: 8px;
		padding: 1px 0;
		font-size: 12px;
		color: var(--muted);
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.track {
		height: 7px;
		background: rgba(0, 255, 65, 0.07);
		border: 1px solid rgba(0, 255, 65, 0.15);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--green-dim);
		transition: width 0.5s ease-out;
	}
	.val {
		text-align: right;
		font-variant-numeric: tabular-nums;
		min-width: 3.5em;
	}
	.level {
		min-width: 6.5em;
		font-size: 11px;
	}
	.top {
		color: var(--green);
		text-shadow: var(--glow);
	}
	.top .fill {
		background: var(--green);
		box-shadow: var(--glow);
	}
</style>
