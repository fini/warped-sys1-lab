import { handle } from '$lib/server/http';
import { listInputSets } from '$lib/server/store';

export const GET = ({ params }) => handle(() => listInputSets(params.project));
