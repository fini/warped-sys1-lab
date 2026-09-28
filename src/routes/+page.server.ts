import { env } from '$env/dynamic/private';
import { listTree } from '$lib/server/store';

// Models are fetched client-side so a slow or unreachable API never blocks the page.
export const load = async () => ({
	tree: await listTree(),
	hasKey: Boolean(env.JEV_API_KEY?.trim())
});
