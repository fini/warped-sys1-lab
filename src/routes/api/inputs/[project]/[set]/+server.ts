import { handle, readBody } from '#lib/server/http.ts';
import { deleteInputSet, readInputSet, writeInputSet } from '#lib/server/store.ts';

export const GET = ({ params }) => handle(() => readInputSet(params.project, params.set));

/** Body is `{ name: text }`. `?create=1` refuses to overwrite. */
export const PUT = ({ params, request, url }) =>
	handle(async () => {
		await writeInputSet(params.project, params.set, await readBody(request), {
			overwrite: url.searchParams.get('create') !== '1'
		});
		return { ok: true };
	});

export const DELETE = ({ params }) => handle(() => deleteInputSet(params.project, params.set));
