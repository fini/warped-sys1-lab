import { handle } from '$lib/server/http';
import { listTree } from '$lib/server/store';

export const GET = () => handle(listTree);
