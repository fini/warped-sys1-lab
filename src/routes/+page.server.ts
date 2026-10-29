import { JEV_API_KEY } from '$app/env/private';
import { listTree } from '#lib/server/store.ts';

// Models are fetched client-side so a slow or unreachable API never blocks the page.
export const load = async () => ({
	tree: await listTree(),
	hasKey: Boolean(JEV_API_KEY?.trim())
});
