import { handle, readBody } from '$lib/server/http';
import { createProject } from '$lib/server/store';

export const POST = ({ request }) =>
	handle(async () => {
		const { project, private: isPrivate } = await readBody(request);
		await createProject(project as string, { isPrivate: isPrivate === true });
		return { ok: true, project, private: isPrivate === true };
	});
