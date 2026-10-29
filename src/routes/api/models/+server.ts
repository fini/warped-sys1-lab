import { handle } from '#lib/server/http.ts';
import { getClient } from '#lib/server/jev.ts';
import { listModels } from '#lib/server/runner.ts';

export const GET = () => handle(() => listModels(getClient()));
