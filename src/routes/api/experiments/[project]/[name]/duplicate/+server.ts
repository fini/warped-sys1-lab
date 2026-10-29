import { handle, readBody } from '#lib/server/http.ts';
import { duplicateExperiment } from '#lib/server/store.ts';

export const POST = ({ params, request }) =>
	handle(async () => {
		const { toProject, toName } = await readBody(request);
		const project = (toProject as string) || params.project;
		await duplicateExperiment(params.project, params.name, project, toName as string);
		return { ok: true, project, name: toName };
	});
