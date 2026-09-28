import { handle, readBody } from '$lib/server/http';
import { deleteProject, renameProject } from '$lib/server/store';

export const PATCH = ({ params, request }) =>
	handle(async () => {
		const { toProject } = await readBody(request);
		await renameProject(params.project, toProject as string);
		return { ok: true, project: toProject };
	});

export const DELETE = ({ params, url }) =>
	handle(() => deleteProject(params.project, url.searchParams.get('force') === '1'));
