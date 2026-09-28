<script lang="ts" module>
	export interface ModalField {
		key: string;
		label: string;
		value: string;
		options?: string[];
		/** Render `options` as a row of radio buttons instead of a select. */
		radio?: boolean;
	}

	export interface ModalRequest {
		title: string;
		message?: string;
		fields?: ModalField[];
		confirmLabel?: string;
		danger?: boolean;
		resolve: (values: Record<string, string> | null) => void;
	}
</script>

<script lang="ts">
	let { request = $bindable() }: { request: ModalRequest | null } = $props();

	let values = $state<Record<string, string>>({});
	let first = $state<HTMLInputElement | HTMLSelectElement>();

	$effect(() => {
		if (request) {
			values = Object.fromEntries((request.fields ?? []).map((f) => [f.key, f.value]));
			queueMicrotask(() => {
				first?.focus();
				if (first instanceof HTMLInputElement) first.select();
			});
		}
	});

	function close(ok: boolean) {
		const r = request;
		request = null;
		r?.resolve(ok ? { ...values } : null);
	}

	function onkeydown(e: KeyboardEvent) {
		if (!request) return;
		if (e.key === 'Escape') close(false);
		if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
			e.preventDefault();
			close(true);
		}
	}
</script>

<svelte:window {onkeydown} />

{#if request}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close(false)}>
		<div class="modal" class:danger={request.danger} role="dialog" aria-modal="true" aria-label={request.title}>
			<h2>&gt; {request.title}</h2>
			{#if request.message}<p>{request.message}</p>{/if}
			{#each request.fields ?? [] as f, i (f.key)}
				{#if f.options && f.radio}
					<div class="field" role="radiogroup" aria-label={f.label}>
						<span>{f.label}</span>
						<div class="radios">
							{#each f.options as o}
								<label class="radio">
									<input type="radio" name={f.key} value={o} bind:group={values[f.key]} />
									{o}
								</label>
							{/each}
						</div>
					</div>
				{:else}
					<label class="field">
						<span>{f.label}</span>
						{#if f.options}
							{#if i === 0}
								<select bind:this={first} bind:value={values[f.key]}>
									{#each f.options as o}<option value={o}>{o}</option>{/each}
								</select>
							{:else}
								<select bind:value={values[f.key]}>
									{#each f.options as o}<option value={o}>{o}</option>{/each}
								</select>
							{/if}
						{:else if i === 0}
							<input bind:this={first} bind:value={values[f.key]} spellcheck="false" autocomplete="off" />
						{:else}
							<input bind:value={values[f.key]} spellcheck="false" autocomplete="off" />
						{/if}
					</label>
				{/if}
			{/each}
			<div class="actions">
				<button onclick={() => close(false)}>Cancel</button>
				<button class={request.danger ? 'danger' : 'primary'} onclick={() => close(true)}>
					{request.confirmLabel ?? 'OK'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 500;
		background: rgba(0, 0, 0, 0.7);
		display: grid;
		place-items: center;
	}
	.modal {
		width: min(440px, 92vw);
		background: var(--panel-solid);
		border: 1px solid var(--green);
		box-shadow:
			0 0 24px rgba(0, 255, 65, 0.25),
			inset 0 0 30px rgba(0, 255, 65, 0.05);
		padding: 18px 20px;
	}
	.modal.danger {
		border-color: var(--red);
		box-shadow: 0 0 24px rgba(255, 51, 85, 0.25);
	}
	h2 {
		margin: 0 0 12px;
		font-size: 14px;
		font-weight: normal;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--green);
		text-shadow: var(--glow);
	}
	.danger h2 {
		color: var(--red);
		text-shadow: 0 0 6px rgba(255, 51, 85, 0.6);
	}
	p {
		margin: 0 0 14px;
		line-height: 1.5;
	}
	.field {
		display: grid;
		gap: 4px;
		margin-bottom: 12px;
	}
	.field > span {
		color: var(--muted);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.radios {
		display: flex;
		gap: 16px;
	}
	.radio {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.radio input {
		accent-color: var(--green);
		margin: 0;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 6px;
	}
</style>
