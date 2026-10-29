import { handle } from '#lib/server/http.ts';
import { listTree } from '#lib/server/store.ts';

export const GET = () => handle(listTree);
