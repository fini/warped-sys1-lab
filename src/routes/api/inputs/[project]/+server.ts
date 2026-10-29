import { handle } from '#lib/server/http.ts';
import { listInputSets } from '#lib/server/store.ts';

export const GET = ({ params }) => handle(() => listInputSets(params.project));
