import { handle } from '$lib/server/http';
import { listResults } from '$lib/server/store';

export const GET = ({ params }) => handle(() => listResults(params.project, params.name));
