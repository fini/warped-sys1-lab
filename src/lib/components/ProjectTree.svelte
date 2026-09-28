<script lang="ts">
	import type { ProjectNode } from '$lib/types';

	export type TreeAction =
		| { kind: 'open'; project: string; name: string }
		| { kind: 'new-project' }
		| { kind: 'new-experiment'; project: string }
		| { kind: 'rename-project'; project: string }
		| { kind: 'delete-project'; project: string }
		| { kind: 'duplicate'; project: string; name: string }
		| { kind: 'rename'; project: string; name: string }
		| { kind: 'delete'; project: string; name: string };

	let {
		tree,
		selected,
		onaction
	}: {
		tree: ProjectNode[];
		selected: { project: string; name: string } | null;
		onaction: (a: TreeAction) => void;
	} = $props();

	let collapsed = $state<Record<string, boolean>>({});
	let filter = $state('');

	const visible = $derived.by(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return tree;
		return tree
			.map((p) => ({
				...p,
				experiments: p.project.toLowerCase().includes(q)
					? p.experiments
					: p.experiments.filter((e) => e.toLowerCase().includes(q))
			}))
			.filter((p) => p.experiments.length || p.project.toLowerCase().includes(q));
	});

	const isSel = (p: string, n: string) => selected?.project === p && selected?.name === n;
</script>

<div class="tree">
	<header>
		<span class="glow">// PROJECTS</span>
		<button onclick={() => onaction({ kind: 'new-project' })} title="New project">+ project</button>
	</header>
	<input class="filter" placeholder="filter…" bind:value={filter} spellcheck="false" />

	<ul class="projects">
		{#each visible as p (p.project)}
			<li>
				<div class="project">
					<button class="icon toggle" onclick={() => (collapsed[p.project] = !collapsed[p.project])}>
						{collapsed[p.project] ? '▸' : '▾'}
					</button>
					{#if p.private}<span class="lock" title="private: experiments_private/, never committed">🔒</span>{/if}
					<span class="pname" class:private={p.private} title={p.private ? `${p.project} (private: experiments_private/, never committed)` : p.project}>{p.project}/</span>
					<span class="count muted">{p.experiments.length}</span>
					<span class="tools">
						<button class="icon" title="New experiment in {p.project}" onclick={() => onaction({ kind: 'new-experiment', project: p.project })}>+</button>
						<button class="icon" title="Rename project" onclick={() => onaction({ kind: 'rename-project', project: p.project })}>✎</button>
						<button class="icon del" title="Delete project" onclick={() => onaction({ kind: 'delete-project', project: p.project })}>✕</button>
					</span>
				</div>
				{#if !collapsed[p.project]}
					<ul class="exps">
						{#each p.experiments as e (e)}
							<li class:sel={isSel(p.project, e)}>
								<button class="open" onclick={() => onaction({ kind: 'open', project: p.project, name: e })} title="{p.project}/{e}">
									<span class="caret">{isSel(p.project, e) ? '>' : ' '}</span>{e}
								</button>
								<span class="tools">
									<button class="icon" title="Duplicate" onclick={() => onaction({ kind: 'duplicate', project: p.project, name: e })}>⧉</button>
									<button class="icon" title="Rename / move" onclick={() => onaction({ kind: 'rename', project: p.project, name: e })}>✎</button>
									<button class="icon del" title="Delete" onclick={() => onaction({ kind: 'delete', project: p.project, name: e })}>✕</button>
								</span>
							</li>
						{:else}
							<li class="empty muted">
								<button class="open" onclick={() => onaction({ kind: 'new-experiment', project: p.project })}>
									<span class="caret"> </span>(empty) + new experiment
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</li>
		{:else}
			<li class="muted empty-tree">No projects yet. Create one to begin.</li>
		{/each}
	</ul>
</div>

<style>
	.tree {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px 8px;
		letter-spacing: 0.1em;
	}
	.filter {
		margin: 0 12px 8px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.projects {
		overflow: auto;
		flex: 1;
		padding-bottom: 12px;
	}
	.project {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px 4px 6px;
		color: var(--green);
		border-top: 1px solid rgba(0, 255, 65, 0.06);
	}
	.pname {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: 0.04em;
	}
	.pname.private {
		color: var(--amber);
	}
	.lock {
		font-size: 10px;
		margin-right: 4px;
	}
	.count {
		font-size: 10px;
	}
	.toggle {
		width: 18px;
		padding: 0;
	}
	.exps li {
		display: flex;
		align-items: center;
		padding-right: 8px;
	}
	.exps li:hover,
	.project:hover {
		background: var(--green-faint);
	}
	.exps li.sel {
		background: rgba(0, 255, 65, 0.14);
		box-shadow: inset 2px 0 0 var(--green);
	}
	.open {
		flex: 1;
		text-align: left;
		border: none;
		text-transform: none;
		letter-spacing: normal;
		font-size: 13px;
		color: var(--text);
		padding: 3px 4px 3px 24px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.open:hover {
		box-shadow: none !important;
		background: none !important;
		color: var(--green);
	}
	.sel .open {
		color: var(--green);
		text-shadow: var(--glow);
	}
	.empty .open {
		color: var(--muted);
		font-style: italic;
	}
	.caret {
		display: inline-block;
		width: 12px;
		white-space: pre;
	}
	.tools {
		display: flex;
		opacity: 0;
		transition: opacity 0.1s;
	}
	li:hover > .tools,
	.project:hover > .tools,
	.tools:focus-within {
		opacity: 1;
	}
	.del:hover {
		color: var(--red);
	}
	.empty-tree {
		padding: 12px;
	}
</style>
