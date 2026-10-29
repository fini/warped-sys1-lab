import { handle } from '#lib/server/http.ts';
import { readResult } from '#lib/server/store.ts';

export const GET = ({ params }) => handle(() => readResult(params.project, params.name, params.id));
