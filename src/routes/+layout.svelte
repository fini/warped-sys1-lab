<script lang="ts">
	import '../app.css';
	import MatrixRain from '$lib/components/MatrixRain.svelte';

	let { children } = $props();
</script>

<MatrixRain />
{@render children()}
