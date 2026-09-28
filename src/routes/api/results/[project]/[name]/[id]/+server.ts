import { handle } from '$lib/server/http';
import { readResult } from '$lib/server/store';

export const GET = ({ params }) => handle(() => readResult(params.project, params.name, params.id));
