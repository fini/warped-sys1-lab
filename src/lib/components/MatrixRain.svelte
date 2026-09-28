<script lang="ts">
	import { onMount } from 'svelte';
	import { fx } from '$lib/fx.svelte';

	let canvas: HTMLCanvasElement;

	const GLYPHS =
		'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789JEV:=*+-<>¦|';
	const SIZE = 16;

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		let drops: number[] = [];
		let raf = 0;
		let last = 0;

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = innerWidth * dpr;
			canvas.height = innerHeight * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			const cols = Math.ceil(innerWidth / SIZE);
			drops = Array.from({ length: cols }, (_, i) => drops[i] ?? Math.random() * -50);
			ctx.fillStyle = '#000';
			ctx.fillRect(0, 0, innerWidth, innerHeight);
		};

		const frame = (t: number) => {
			raf = requestAnimationFrame(frame);
			// ~20 fps idle, ~50 fps while a run is in flight
			if (t - last < (fx.running ? 20 : 50)) return;
			last = t;

			ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
			ctx.fillRect(0, 0, innerWidth, innerHeight);
			ctx.font = `${SIZE}px monospace`;

			for (let i = 0; i < drops.length; i++) {
				const y = drops[i] * SIZE;
				const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
				ctx.fillStyle = Math.random() > 0.975 ? '#d8ffe0' : '#00ff41';
				ctx.fillText(ch, i * SIZE, y);
				if (y > innerHeight && Math.random() > 0.975) drops[i] = 0;
				drops[i] += fx.running ? 1.4 : 1;
			}
		};

		const onVisibility = () => {
			cancelAnimationFrame(raf);
			if (!document.hidden) raf = requestAnimationFrame(frame);
		};

		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		resize();
		addEventListener('resize', resize);
		document.addEventListener('visibilitychange', onVisibility);
		if (!reduced) raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			removeEventListener('resize', resize);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		z-index: 0;
		opacity: 0.35;
		pointer-events: none;
	}
</style>
