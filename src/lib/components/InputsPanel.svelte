<script lang="ts">
	import type { InputValues } from '$lib/types';

	let {
		names,
		values = $bindable(),
		sets,
		active,
		dirty,
		onselect,
		onnew,
		onrename,
		ondelete,
		onsave
	}: {
		/** Placeholder names found in the experiment, in order. */
		names: string[];
		values: InputValues;
		sets: string[];
		active: string | null;
		dirty: boolean;
		onselect: (set: string) => void;
		onnew: () => void;
		onrename: () => void;
		ondelete: () => void;
		onsave: () => void;
	} = $props();

	const rows = (v: string | undefined) => Math.min(14, Math.max(3, (v ?? '').split('\n').length));
	const unused = $derived(Object.keys(values).filter((k) => !names.includes(k) && values[k]));
</script>

<div class="inputs">
	<div class="bar">
		<span class="glow">// INPUTS</span>
		<span class="spacer"></span>
		<button class="icon" onclick={onnew} title="New input set">+</button>
		<button class="icon" onclick={onrename} disabled={!active} title="Rename input set">✎</button>
		<button class="icon" onclick={ondelete} disabled={!active} title="Delete input set">✕</button>
	</div>

	<div class="sets">
		<select
			value={active ?? ''}
			onchange={(e) => onselect((e.currentTarget as HTMLSelectElement).value)}
			title="Input set (saved in this project's _inputs/ folder)"
		>
			{#if !active}<option value="">(unsaved)</option>{/if}
			{#each sets as s (s)}
				<option value={s}>{s}</option>
			{/each}
		</select>
		{#if dirty}<span class="dirty" title="Unsaved input changes">●</span>{/if}
		<button onclick={onsave} disabled={!dirty} title="Save input set">Save</button>
	</div>

	<div class="fields">
		{#each names as n (n)}
			<label>
				<span class="name">{'${'}{n}{'}'}</span>
				<textarea
					rows={rows(values[n])}
					spellcheck="false"
					placeholder="paste text for {n}…"
					value={values[n] ?? ''}
					oninput={(e) => (values = { ...values, [n]: (e.currentTarget as HTMLTextAreaElement).value })}
				></textarea>
			</label>
		{/each}
		{#if unused.length}
			<div class="muted note">also in this set, not used here: {unused.join(', ')}</div>
		{/if}
	</div>
</div>

<style>
	.inputs {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 10px 12px 6px;
		letter-spacing: 0.1em;
	}
	.sets {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 12px 8px;
	}
	.sets select {
		flex: 1;
		min-width: 0;
		font-size: 12px;
		padding: 3px 6px;
	}
	.spacer {
		flex: 1;
	}
	.dirty {
		color: var(--amber);
	}
	.fields {
		flex: 1;
		overflow: auto;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 0 12px 12px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 3px;
		flex-shrink: 0;
	}
	.name {
		font-size: 11px;
		color: var(--green);
	}
	textarea {
		background: #000;
		border: 1px solid var(--line-strong);
		padding: 6px 8px;
		outline: none;
		resize: vertical;
		line-height: 1.45;
		font-size: 12px;
	}
	textarea:focus {
		border-color: var(--green);
		box-shadow: var(--glow);
	}
	.note {
		font-size: 11px;
	}
</style>
