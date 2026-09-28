<script lang="ts">
	let {
		value = $bindable(),
		errorLine = null
	}: {
		value: string;
		errorLine?: number | null;
	} = $props();

	let ta: HTMLTextAreaElement;
	let gutter: HTMLDivElement;

	const lines = $derived(value.split('\n').length);
	const INDENT = '  ';

	function syncScroll() {
		gutter.scrollTop = ta.scrollTop;
	}

	/** Replace the selection via execCommand so native undo/redo keeps working. */
	function insert(text: string) {
		if (!document.execCommand('insertText', false, text)) {
			const { selectionStart: s, selectionEnd: e } = ta;
			ta.setRangeText(text, s, e, 'end');
			value = ta.value;
		}
	}

	function onkeydown(e: KeyboardEvent) {
		const { selectionStart: s, selectionEnd: end } = ta;
		if (e.key === 'Tab') {
			e.preventDefault();
			const lineStart = value.lastIndexOf('\n', s - 1) + 1;
			if (s === end && !e.shiftKey) return insert(INDENT);
			// Indent / outdent every selected line.
			const blockEnd = value.indexOf('\n', end - (end > s && value[end - 1] === '\n' ? 1 : 0));
			const stop = blockEnd === -1 ? value.length : blockEnd;
			const block = value.slice(lineStart, stop);
			const next = e.shiftKey
				? block.replace(/^ {1,2}/gm, '')
				: block.replace(/^/gm, INDENT);
			ta.setSelectionRange(lineStart, stop);
			insert(next);
			ta.setSelectionRange(lineStart, lineStart + next.length);
		} else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
			// Keep indentation; indent one more level after an opening bracket.
			e.preventDefault();
			const lineStart = value.lastIndexOf('\n', s - 1) + 1;
			const indent = /^\s*/.exec(value.slice(lineStart, s))![0];
			const prev = value.slice(0, s).trimEnd().at(-1);
			const nextCh = value.slice(end).trimStart()[0];
			if ((prev === '{' || prev === '[') && (nextCh === '}' || nextCh === ']') && value.slice(s, end + 1).trim() === '') {
				insert(`\n${indent}${INDENT}\n${indent}`);
				const pos = s + 1 + indent.length + INDENT.length;
				ta.setSelectionRange(pos, pos);
			} else {
				insert('\n' + indent + (prev === '{' || prev === '[' ? INDENT : ''));
			}
		}
	}

	/** Move the caret to a line (1-based) and scroll it into view. */
	export function gotoLine(line: number) {
		const idx = value.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
		ta.focus();
		ta.setSelectionRange(idx, idx);
		const lh = parseFloat(getComputedStyle(ta).lineHeight);
		ta.scrollTop = Math.max(0, (line - 5) * lh);
	}
</script>

<div class="editor">
	<div class="gutter" bind:this={gutter} aria-hidden="true">
		{#each { length: lines } as _, i}
			<div class:err={errorLine === i + 1}>{i + 1}</div>
		{/each}
		<div class="pad"></div>
	</div>
	<textarea
		bind:this={ta}
		bind:value
		{onkeydown}
		onscroll={syncScroll}
		spellcheck="false"
		autocomplete="off"
		autocapitalize="off"
		wrap="off"
		aria-label="Experiment JSON"
	></textarea>
</div>

<style>
	.editor {
		display: flex;
		flex: 1;
		min-height: 0;
		border: 1px solid var(--line);
		background: rgba(0, 0, 0, 0.7);
		--lh: 19px;
	}
	.editor:focus-within {
		border-color: var(--line-strong);
		box-shadow: inset 0 0 20px rgba(0, 255, 65, 0.05);
	}
	.gutter {
		overflow: hidden;
		padding: 10px 0;
		min-width: 44px;
		text-align: right;
		color: rgba(0, 255, 65, 0.3);
		border-right: 1px solid var(--line);
		user-select: none;
		font-size: 12px;
		line-height: var(--lh);
	}
	.gutter div {
		padding: 0 8px 0 4px;
	}
	.gutter .err {
		background: rgba(255, 51, 85, 0.3);
		color: var(--red);
	}
	.gutter .pad {
		height: 40px;
	}
	textarea {
		flex: 1;
		resize: none;
		border: none;
		outline: none;
		background: transparent;
		color: var(--text);
		caret-color: var(--green);
		padding: 10px 12px 40px;
		line-height: var(--lh);
		font-size: 13px;
		tab-size: 2;
		white-space: pre;
		overflow: auto;
	}
</style>
