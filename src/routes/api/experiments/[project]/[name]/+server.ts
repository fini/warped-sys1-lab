import { handle } from '#lib/server/http.ts';
import { deleteExperiment, readExperimentRaw, writeExperiment } from '#lib/server/store.ts';

/** Returns the file as-is so formatting and key order are preserved in the editor. */
export const GET = ({ params }) =>
	handle(async () =>
		new Response(await readExperimentRaw(params.project, params.name), {
			headers: { 'content-type': 'application/json' }
		})
	);

/** Body is the raw JSON text. `?create=1` refuses to overwrite. */
export const PUT = ({ params, request, url }) =>
	handle(async () => {
		const content = await request.text();
		await writeExperiment(params.project, params.name, content, {
			overwrite: url.searchParams.get('create') !== '1'
		});
		return { ok: true };
	});

export const DELETE = ({ params }) => handle(() => deleteExperiment(params.project, params.name));
