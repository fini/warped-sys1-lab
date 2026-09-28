import { handle, readBody } from '$lib/server/http';
import { renameExperiment } from '$lib/server/store';

export const POST = ({ params, request }) =>
	handle(async () => {
		const { toProject, toName } = await readBody(request);
		const project = (toProject as string) || params.project;
		const name = (toName as string) || params.name;
		await renameExperiment(params.project, params.name, project, name);
		return { ok: true, project, name };
	});
