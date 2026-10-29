import { handle, readBody } from '#lib/server/http.ts';
import { createProject } from '#lib/server/store.ts';

export const POST = ({ request }) =>
	handle(async () => {
		const { project, private: isPrivate } = await readBody(request);
		await createProject(project as string, { isPrivate: isPrivate === true });
		return { ok: true, project, private: isPrivate === true };
	});
