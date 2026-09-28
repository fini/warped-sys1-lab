<script lang="ts">
	import { pct } from '$lib/format';

	let {
		label,
		value,
		highlight = false,
		hint = ''
	}: { label: string; value: number; highlight?: boolean; hint?: string } = $props();
</script>

<div class="row" class:highlight title={hint || label}>
	<span class="label">{label}</span>
	<span class="track"><span class="fill" style:width="{Math.max(0, Math.min(1, value)) * 100}%"></span></span>
	<span class="val">{pct(value)}</span>
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: minmax(80px, 38%) 1fr 52px;
		align-items: center;
		gap: 8px;
		padding: 2px 0;
		color: var(--muted);
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.track {
		height: 8px;
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
	}
	.highlight {
		color: var(--green);
		text-shadow: var(--glow);
	}
	.highlight .fill {
		background: var(--green);
		box-shadow: var(--glow);
	}
</style>
