import { handle } from '#lib/server/http.ts';
import { listResults } from '#lib/server/store.ts';

export const GET = ({ params }) => handle(() => listResults(params.project, params.name));
