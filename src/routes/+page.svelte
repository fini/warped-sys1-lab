<script lang="ts">
	import { onMount, tick } from 'svelte';
	import ProjectTree, { type TreeAction } from '$lib/components/ProjectTree.svelte';
	import JsonEditor from '$lib/components/JsonEditor.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import InputsPanel from '$lib/components/InputsPanel.svelte';
	import Modal, { type ModalField, type ModalRequest } from '$lib/components/Modal.svelte';
	import { api, ApiError } from '$lib/api';
	import { parseJson } from '$lib/format';
	import { fx } from '$lib/fx.svelte';
	import { findPlaceholders, missingInputs, usedInputs } from '$lib/inputs';
	import { isValidName, newExperimentTemplate, validateExperiment } from '$lib/validate';
	import type { InputValues, ModelInfo, ProjectNode, ResultSummary, RunResult } from '$lib/types';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let tree = $state<ProjectNode[]>(data.tree);
	let selected = $state<{ project: string; name: string } | null>(null);
	let text = $state('');
	let savedText = $state('');
	let models = $state<ModelInfo[]>([]);
	let modelsError = $state<string | null>(null);

	let result = $state<RunResult | null>(null);
	let runError = $state<string | null>(null);
	let running = $state(false);
	let history = $state<ResultSummary[]>([]);

	// Input sets live per project; `activeSet` null means the values aren't saved as a set yet.
	let inputSets = $state<string[]>([]);
	let activeSet = $state<string | null>(null);
	let inputValues = $state<InputValues>({});
	let savedInputValues = $state<InputValues>({});
	let setsProject: string | null = null;

	let modal = $state<ModalRequest | null>(null);
	let toast = $state<{ msg: string; bad?: boolean } | null>(null);
	let editor = $state<JsonEditor>();

	const dirty = $derived(selected !== null && text !== savedText);
	const parsed = $derived(parseJson(text));
	const placeholders = $derived(parsed.ok ? findPlaceholders(parsed.value) : []);
	const missing = $derived(parsed.ok ? missingInputs(parsed.value, inputValues) : []);
	const inputsDirty = $derived(JSON.stringify(inputValues) !== JSON.stringify(savedInputValues));
	const problems = $derived(parsed.ok ? validateExperiment(parsed.value) : []);
	const currentModel = $derived.by(() => {
		if (!parsed.ok) return '';
		const m = (parsed.value as { model?: unknown })?.model;
		return typeof m === 'string' ? m : '';
	});
	const projects = $derived(tree.map((p) => p.project));

	// ---------------------------------------------------------------------------
	// helpers

	let toastTimer: ReturnType<typeof setTimeout>;
	function notify(msg: string, bad = false) {
		toast = { msg, bad };
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), bad ? 5000 : 2200);
	}

	const ask = (req: Omit<ModalRequest, 'resolve'>) =>
		new Promise<Record<string, string> | null>((resolve) => (modal = { ...req, resolve }));

	const sameValues = (a: InputValues, b: InputValues) =>
		JSON.stringify(Object.entries(a).filter((e) => e[1]).sort()) === JSON.stringify(Object.entries(b).filter((e) => e[1]).sort());

	const confirmDiscard = async () =>
		!dirty ||
		(await ask({
			title: 'Unsaved changes',
			message: `Discard changes to ${selected!.project}/${selected!.name}?`,
			confirmLabel: 'Discard',
			danger: true
		})) !== null;

	async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
		try {
			return await fn();
		} catch (e) {
			notify(e instanceof Error ? e.message : String(e), true);
		}
	}

	const refreshTree = async () => {
		tree = await api.tree();
	};

	const slug = (s: string) =>
		s
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, '-')
			.replace(/^[-.]+|-+$/g, '');

	function nameField(key: string, label: string, value: string): ModalField {
		return { key, label, value };
	}
	const projectField = (value: string): ModalField => ({ key: 'project', label: 'Project', value, options: projects });

	/** Validate a name from a modal, normalising it to a slug. */
	function checkName(raw: string | undefined, kind: string): string | null {
		const s = slug(raw ?? '');
		if (!isValidName(s)) {
			notify(`Invalid ${kind} name. Use letters, digits, ".", "_" or "-".`, true);
			return null;
		}
		return s;
	}

	// ---------------------------------------------------------------------------
	// experiments

	async function open(project: string, name: string, { force = false } = {}) {
		if (!force && !(await confirmDiscard())) return;
		await guard(async () => {
			const raw = await api.readExperiment(project, name);
			selected = { project, name };
			text = savedText = raw;
			result = null;
			runError = null;
			history = await api.results(project, name).catch(() => []);
			if (history[0]) result = await api.result(project, name, history[0].id).catch(() => null);
			localStorage.setItem('jev-lab:last', `${project}/${name}`);
			if (setsProject !== project) await loadInputSets(project);
		});
	}

	async function save() {
		if (!selected) return;
		if (!parsed.ok) return notify('Cannot save: JSON does not parse.', true);
		const { project, name } = selected;
		await guard(async () => {
			await api.saveExperiment(project, name, text);
			savedText = text;
			notify(`saved ${project}/${name}`);
		});
	}

	function format() {
		if (!parsed.ok) return notify('Cannot format: JSON does not parse.', true);
		text = JSON.stringify(parsed.value, null, 2) + '\n';
	}

	function setModel(model: string) {
		if (!parsed.ok || typeof parsed.value !== 'object' || parsed.value === null) {
			return notify('Fix the JSON before changing the model.', true);
		}
		const obj = parsed.value as Record<string, unknown>;
		// Keep `model` near the top for readability.
		const { name, description, model: _old, ...rest } = obj;
		const next: Record<string, unknown> = {};
		if (name !== undefined) next.name = name;
		if (description !== undefined) next.description = description;
		if (model) next.model = model;
		text = JSON.stringify({ ...next, ...rest }, null, 2) + '\n';
	}

	// ---------------------------------------------------------------------------
	// input sets

	const lastSetKey = (project: string) => `jev-lab:inputs:${project}`;

	async function loadInputSets(project: string) {
		setsProject = project;
		inputSets = await api.inputSets(project).catch(() => []);
		const last = localStorage.getItem(lastSetKey(project));
		const pick = last && inputSets.includes(last) ? last : (inputSets[0] ?? null);
		if (pick) await selectSet(pick, { force: true });
		else {
			activeSet = null;
			inputValues = savedInputValues = {};
		}
	}

	const confirmDiscardInputs = async () =>
		!inputsDirty ||
		(await ask({
			title: 'Unsaved inputs',
			message: activeSet ? `Discard changes to input set "${activeSet}"?` : 'Discard the unsaved input values?',
			confirmLabel: 'Discard',
			danger: true
		})) !== null;

	async function selectSet(set: string, { force = false } = {}) {
		if (!selected || !set) return;
		if (!force && !(await confirmDiscardInputs())) {
			activeSet = activeSet; // snap the dropdown back
			return;
		}
		const project = selected.project;
		await guard(async () => {
			const values = await api.readInputSet(project, set);
			activeSet = set;
			inputValues = values;
			savedInputValues = { ...values };
			localStorage.setItem(lastSetKey(project), set);
		});
	}

	/** Save to the active set, or ask for a name when there isn't one. */
	async function saveInputs() {
		if (!selected) return;
		if (!activeSet) return newSet({ keepValues: true });
		const { project } = selected;
		const set = activeSet;
		await guard(async () => {
			await api.saveInputSet(project, set, inputValues);
			savedInputValues = { ...inputValues };
			notify(`saved input set ${set}`);
		});
	}

	async function newSet({ keepValues = false } = {}) {
		if (!selected) return;
		if (!keepValues && !(await confirmDiscardInputs())) return;
		const v = await ask({
			title: 'New input set',
			message: keepValues ? 'Save the current values as a new set.' : 'Starts empty. Placeholders come from the experiment JSON.',
			fields: [nameField('name', 'Set name', '')],
			confirmLabel: 'Create'
		});
		const set = v && checkName(v.name, 'input set');
		if (!set) return;
		const { project } = selected;
		const values = keepValues ? inputValues : Object.fromEntries(placeholders.map((n) => [n, '']));
		await guard(async () => {
			await api.saveInputSet(project, set, values, true);
			inputSets = await api.inputSets(project);
			activeSet = set;
			inputValues = { ...values };
			savedInputValues = { ...values };
			localStorage.setItem(lastSetKey(project), set);
			notify(`input set ${set} created`);
		});
	}

	async function renameSet() {
		if (!selected || !activeSet) return;
		const from = activeSet;
		const v = await ask({ title: `Rename input set ${from}`, fields: [nameField('name', 'Set name', from)], confirmLabel: 'Rename' });
		const set = v && checkName(v.name, 'input set');
		if (!set || set === from) return;
		const { project } = selected;
		await guard(async () => {
			await api.renameInputSet(project, from, set);
			inputSets = await api.inputSets(project);
			activeSet = set;
			localStorage.setItem(lastSetKey(project), set);
		});
	}

	async function deleteSet() {
		if (!selected || !activeSet) return;
		const set = activeSet;
		const ok = await ask({
			title: 'Delete input set',
			message: `Permanently delete input set "${set}" from ${selected.project}/?`,
			confirmLabel: 'Delete',
			danger: true
		});
		if (!ok) return;
		const { project } = selected;
		await guard(async () => {
			await api.deleteInputSet(project, set);
			localStorage.removeItem(lastSetKey(project));
			await loadInputSets(project);
		});
	}

	async function run() {
		if (running) return;
		if (!parsed.ok) {
			if (parsed.line) editor?.gotoLine(parsed.line);
			return notify('Cannot run: JSON does not parse.', true);
		}
		if (problems.length) return notify(problems[0], true);
		if (missing.length) return notify(`Input \`${missing[0]}\` is empty.`, true);
		running = fx.running = true;
		runError = null;
		const inputs = placeholders.length
			? { ...(activeSet ? { set: activeSet } : {}), values: usedInputs(parsed.value, inputValues) }
			: undefined;
		try {
			result = await api.run(parsed.value, selected?.project, selected?.name, inputs);
			if (selected) history = await api.results(selected.project, selected.name).catch(() => history);
			const bad = result.runs.filter((r) => r.error).length;
			if (bad) notify(`${bad} of ${result.runs.length} case(s) failed`, true);
		} catch (e) {
			result = null;
			runError = e instanceof ApiError ? e.message : String(e);
		} finally {
			running = fx.running = false;
		}
	}

	async function pickHistory(id: string) {
		if (!selected || !id) return;
		const r = await guard(() => api.result(selected!.project, selected!.name, id));
		if (r) {
			result = r;
			runError = null;
		}
	}

	async function loadRunInput() {
		if (!result) return;
		text = JSON.stringify(result.input, null, 2) + '\n';
		if (result.inputs) {
			const setExists = !!result.inputs.set && inputSets.includes(result.inputs.set);
			activeSet = setExists ? result.inputs.set! : null;
			savedInputValues = setExists && selected ? await api.readInputSet(selected.project, activeSet!).catch(() => ({})) : {};
			inputValues = { ...result.inputs.values };
		}
		notify('loaded run input into editor (unsaved)');
	}

	// ---------------------------------------------------------------------------
	// tree actions

	async function onaction(a: TreeAction) {
		switch (a.kind) {
			case 'open':
				return open(a.project, a.name);

			case 'new-project': {
				const v = await ask({
					title: 'New project',
					message: 'Private projects live in experiments_private/ and are never committed.',
					fields: [
						nameField('name', 'Folder name', ''),
						{ key: 'visibility', label: 'Visibility', value: 'public', options: ['public', 'private'], radio: true }
					],
					confirmLabel: 'Create'
				});
				const name = v && checkName(v.name, 'project');
				if (!name) return;
				const isPrivate = v.visibility === 'private';
				await guard(async () => {
					await api.createProject(name, isPrivate);
					await refreshTree();
					notify(`project ${name}/ created${isPrivate ? ' (private)' : ''}`);
				});
				return;
			}

			case 'new-experiment': {
				if (!(await confirmDiscard())) return;
				const v = await ask({
					title: 'New experiment',
					fields: [nameField('name', 'Experiment name', 'untitled'), projectField(a.project)],
					confirmLabel: 'Create'
				});
				const name = v && checkName(v.name, 'experiment');
				if (!v || !name) return;
				await guard(async () => {
					const content = JSON.stringify(newExperimentTemplate(v.name.trim() || name), null, 2) + '\n';
					await api.saveExperiment(v.project, name, content, true);
					await refreshTree();
					await open(v.project, name, { force: true });
				});
				return;
			}

			case 'duplicate': {
				if (!(await confirmDiscard())) return;
				const v = await ask({
					title: `Duplicate ${a.project}/${a.name}`,
					fields: [nameField('name', 'New name', `${a.name}-copy`), projectField(a.project)],
					confirmLabel: 'Duplicate'
				});
				const name = v && checkName(v.name, 'experiment');
				if (!v || !name) return;
				await guard(async () => {
					await api.duplicateExperiment(a.project, a.name, v.project, name);
					await refreshTree();
					await open(v.project, name, { force: true });
				});
				return;
			}

			case 'rename': {
				const isOpen = selected?.project === a.project && selected?.name === a.name;
				if (isOpen && dirty) return notify('Save or discard changes before renaming.', true);
				const v = await ask({
					title: `Rename / move ${a.project}/${a.name}`,
					fields: [nameField('name', 'Name', a.name), projectField(a.project)],
					confirmLabel: 'Rename'
				});
				const name = v && checkName(v.name, 'experiment');
				if (!v || !name || (name === a.name && v.project === a.project)) return;
				await guard(async () => {
					await api.renameExperiment(a.project, a.name, v.project, name);
					await refreshTree();
					if (isOpen) selected = { project: v.project, name };
					notify(`→ ${v.project}/${name}`);
				});
				return;
			}

			case 'delete': {
				const ok = await ask({
					title: 'Delete experiment',
					message: `Permanently delete ${a.project}/${a.name}? Saved results are kept in results/.`,
					confirmLabel: 'Delete',
					danger: true
				});
				if (!ok) return;
				await guard(async () => {
					await api.deleteExperiment(a.project, a.name);
					if (selected?.project === a.project && selected?.name === a.name) {
						selected = null;
						text = savedText = '';
						result = null;
						history = [];
					}
					await refreshTree();
				});
				return;
			}

			case 'rename-project': {
				if (selected?.project === a.project && dirty) return notify('Save or discard changes first.', true);
				const v = await ask({ title: `Rename project ${a.project}/`, fields: [nameField('name', 'Folder name', a.project)], confirmLabel: 'Rename' });
				const name = v && checkName(v.name, 'project');
				if (!name || name === a.project) return;
				await guard(async () => {
					await api.renameProject(a.project, name);
					await refreshTree();
					if (selected?.project === a.project) {
						selected = { ...selected, project: name };
						await loadInputSets(name);
					}
				});
				return;
			}

			case 'delete-project': {
				const count = tree.find((p) => p.project === a.project)?.experiments.length ?? 0;
				const ok = await ask({
					title: 'Delete project',
					message: count
						? `${a.project}/ contains ${count} experiment(s). Delete the folder and everything in it?`
						: `Delete empty project ${a.project}/?`,
					confirmLabel: 'Delete',
					danger: true
				});
				if (!ok) return;
				await guard(async () => {
					await api.deleteProject(a.project, true);
					if (selected?.project === a.project) {
						selected = null;
						text = savedText = '';
						result = null;
						history = [];
					}
					await refreshTree();
				});
				return;
			}
		}
	}

	// ---------------------------------------------------------------------------
	// lifecycle

	function onkeydown(e: KeyboardEvent) {
		if (modal) return;
		const mod = e.metaKey || e.ctrlKey;
		if (mod && e.key.toLowerCase() === 's') {
			e.preventDefault();
			save();
		} else if (mod && e.key === 'Enter') {
			e.preventDefault();
			run();
		} else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
			e.preventDefault();
			format();
		}
	}

	function onbeforeunload(e: BeforeUnloadEvent) {
		if (dirty || inputsDirty) e.preventDefault();
	}

	onMount(async () => {
		const last = localStorage.getItem('jev-lab:last')?.split('/');
		const first = tree.find((p) => p.experiments.length);
		if (last && tree.some((p) => p.project === last[0] && p.experiments.includes(last[1]))) {
			await open(last[0], last[1]);
		} else if (first) {
			await open(first.project, first.experiments[0]);
		}
		await tick();
		if (!data.hasKey) return;
		api
			.models()
			.then((m) => (models = m))
			.catch((e) => (modelsError = e.message));
	});
</script>

<svelte:window {onkeydown} {onbeforeunload} />

<div class="app">
	<header class="top">
		<h1><span class="glow">&gt; JEV://WARPED_EXPERIMENT_LAB</span><span class="cursor">_</span></h1>
		<span class="muted sub">system one · typesafe.ai</span>
		<span class="spacer"></span>
		{#if !data.hasKey}
			<span class="warn">⚠ JEV_API_KEY missing: add it to .env</span>
		{:else if modelsError}
			<span class="warn" title={modelsError}>⚠ API unreachable</span>
		{:else}
			<span class="ok">● link {models.length ? 'established' : 'pending'}</span>
		{/if}
	</header>

	<main>
		<aside class="panel side">
			<div class="side-tree">
				<ProjectTree {tree} {selected} {onaction} />
			</div>
			{#if selected && placeholders.length}
				<div class="side-inputs">
					<InputsPanel
						names={placeholders}
						bind:values={inputValues}
						sets={inputSets}
						active={activeSet}
						dirty={inputsDirty}
						onselect={(s) => selectSet(s)}
						onnew={() => newSet()}
						onrename={renameSet}
						ondelete={deleteSet}
						onsave={saveInputs}
					/>
				</div>
			{/if}
		</aside>

		<section class="panel center">
			{#if selected}
				<div class="bar">
					<span class="path" title="experiments/{selected.project}/{selected.name}.json">
						<span class="muted">{selected.project}/</span><span class="glow">{selected.name}</span><span class="muted">.json</span>
						{#if dirty}<span class="dirty" title="Unsaved changes">●</span>{/if}
					</span>
					<span class="spacer"></span>
					<label class="model">
						<span class="muted">model</span>
						<select value={currentModel} onchange={(e) => setModel((e.currentTarget as HTMLSelectElement).value)}>
							<option value="">(default: jev-latest)</option>
							{#each models as m (m.name)}
								<option value={m.name} title={m.description}>{m.name}</option>
							{/each}
							{#if currentModel && !models.some((m) => m.name === currentModel)}
								<option value={currentModel}>{currentModel}</option>
							{/if}
						</select>
					</label>
				</div>

				<JsonEditor bind:this={editor} bind:value={text} errorLine={parsed.ok ? null : (parsed.line ?? null)} />

				<div class="status">
					{#if !parsed.ok}
						<button class="linkish bad" onclick={() => parsed.ok || (parsed.line && editor?.gotoLine(parsed.line))}>
							✖ {parsed.line ? `line ${parsed.line}: ` : ''}{parsed.message}
						</button>
					{:else if missing.length}
						<span class="warnline" title={missing.map((n) => `Input \`${n}\` is empty.`).join('\n')}>⚠ input `{missing[0]}` is empty{missing.length > 1 ? ` (+${missing.length - 1} more)` : ''}</span>
					{:else if problems.length}
						<span class="warnline" title={problems.join('\n')}>⚠ {problems[0]}{problems.length > 1 ? ` (+${problems.length - 1} more)` : ''}</span>
					{:else}
						<span class="okline">✔ valid · {Object.keys((parsed.value as { questions: object }).questions).length} question(s){(parsed.value as { cases?: unknown[] }).cases ? ` · ${(parsed.value as { cases: unknown[] }).cases.length} case(s)` : ''}{placeholders.length ? ` · ${placeholders.length} input(s)` : ''}</span>
					{/if}
					<span class="spacer"></span>
					<button onclick={format} title="Format (Ctrl/⌘+Shift+F)">Format</button>
					<button onclick={() => (text = savedText)} disabled={!dirty} title="Revert to saved">Revert</button>
					<button onclick={save} disabled={!dirty || !parsed.ok} title="Save (Ctrl/⌘+S)">Save</button>
					<button class="primary run" onclick={run} disabled={running || !parsed.ok || problems.length > 0 || missing.length > 0 || !data.hasKey} title="Run (Ctrl/⌘+Enter)">
						{running ? 'Running…' : '▶ Run'}
					</button>
				</div>
			{:else}
				<div class="empty">
					<pre class="glow">{`   ┌──────────────────────────────┐
   │  follow the white rabbit…    │
   └──────────────────────────────┘`}</pre>
					<p class="muted">Select an experiment on the left, or create a new one.</p>
				</div>
			{/if}
		</section>

		<aside class="panel">
			<ResultsPanel {result} error={runError} {running} {history} onpick={pickHistory} />
			{#if result && selected && (JSON.stringify(result.input) !== JSON.stringify(parsed.ok ? parsed.value : null) || (result.inputs && !sameValues(result.inputs.values, usedInputs(result.input, inputValues))))}
				<div class="restore">
					<button onclick={loadRunInput} title="Replace the editor contents with the JSON this run used">↺ load this run's input</button>
				</div>
			{/if}
		</aside>
	</main>
</div>

<Modal bind:request={modal} />

{#if toast}
	<div class="toast" class:bad={toast.bad} role="status">{toast.msg}</div>
{/if}

<style>
	.app {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		height: 100vh;
	}
	.top {
		display: flex;
		align-items: baseline;
		gap: 14px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--line);
		background: rgba(0, 0, 0, 0.75);
	}
	h1 {
		margin: 0;
		font-size: 17px;
		font-weight: normal;
		letter-spacing: 0.14em;
	}
	.cursor {
		color: var(--green);
		animation: blink 1s steps(1) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
	.sub {
		font-size: 11px;
		letter-spacing: 0.1em;
	}
	.spacer {
		flex: 1;
	}
	.ok {
		color: var(--green);
		font-size: 11px;
		letter-spacing: 0.08em;
	}
	.warn {
		color: var(--amber);
		font-size: 11px;
	}
	main {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(240px, 320px) minmax(360px, 1fr) minmax(320px, 440px);
		gap: 10px;
		padding: 10px;
	}
	.panel {
		background: var(--panel);
		border: 1px solid var(--line);
		box-shadow: inset 0 0 40px rgba(0, 255, 65, 0.03);
		min-height: 0;
		display: flex;
		flex-direction: column;
		backdrop-filter: blur(1.5px);
	}
	/* Sidebar: project tree on top, inputs below; each scrolls on its own. */
	.side-tree {
		flex: 1 1 40%;
		min-height: 120px;
		display: flex;
		flex-direction: column;
	}
	.side-inputs {
		flex: 1 1 60%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--line);
	}
	.center {
		padding: 10px;
		gap: 8px;
	}
	.bar,
	.status {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.path {
		font-size: 14px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.dirty {
		color: var(--amber);
		margin-left: 6px;
	}
	.model {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}
	.model select {
		font-size: 12px;
		padding: 3px 6px;
	}
	.status {
		font-size: 12px;
		min-height: 28px;
	}
	.status > span:first-child,
	.linkish {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.linkish {
		border: none;
		padding: 0;
		text-transform: none;
		letter-spacing: normal;
		font-size: 12px;
		text-align: left;
	}
	.linkish:hover {
		box-shadow: none !important;
		text-decoration: underline;
	}
	.bad {
		color: var(--red);
	}
	.okline {
		color: var(--green-dim);
	}
	.warnline {
		color: var(--amber);
	}
	.run {
		min-width: 92px;
	}
	.empty {
		margin: auto;
		text-align: center;
	}
	.restore {
		padding: 8px 12px;
		border-top: 1px dashed var(--line);
	}
	.restore button {
		width: 100%;
		text-transform: none;
		letter-spacing: normal;
	}
	.toast {
		position: fixed;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 600;
		background: var(--panel-solid);
		border: 1px solid var(--green);
		color: var(--green);
		padding: 8px 16px;
		box-shadow: 0 0 16px rgba(0, 255, 65, 0.3);
		max-width: 80vw;
	}
	.toast.bad {
		border-color: var(--red);
		color: #ffb3c0;
		box-shadow: 0 0 16px rgba(255, 51, 85, 0.3);
	}
	@media (max-width: 1100px) {
		main {
			grid-template-columns: 260px 1fr;
			grid-template-rows: 1fr 1fr;
		}
		main > aside:last-child {
			grid-column: 1 / -1;
		}
	}
</style>
