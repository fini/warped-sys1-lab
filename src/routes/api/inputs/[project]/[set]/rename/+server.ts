import { handle, readBody } from '#lib/server/http.ts';
import { renameInputSet } from '#lib/server/store.ts';

export const POST = ({ params, request }) =>
	handle(async () => {
		const { toSet } = await readBody(request);
		await renameInputSet(params.project, params.set, toSet as string);
		return { ok: true, set: toSet };
	});
