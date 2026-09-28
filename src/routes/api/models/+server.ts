import { handle } from '$lib/server/http';
import { getClient } from '$lib/server/jev';
import { listModels } from '$lib/server/runner';

export const GET = () => handle(() => listModels(getClient()));
