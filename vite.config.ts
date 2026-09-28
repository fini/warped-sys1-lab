import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Experiment and result files are written by the app itself; don't trigger reloads.
	server: { watch: { ignored: ['**/experiments/**', '**/experiments_private/**', '**/results/**'] } }
});
