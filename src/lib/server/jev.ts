import { env } from '$env/dynamic/private';
import { createClient } from './runner';
import type { TypeSafeClient } from '@typesafe-ai/sdk';

let client: TypeSafeClient | undefined;
let clientKey: string | undefined;

/** Lazily build the SDK client, rebuilding if the key in the environment changes. */
export function getClient(): TypeSafeClient {
	const key = env.JEV_API_KEY;
	if (!client || key !== clientKey) {
		client = createClient(key, env.TYPESAFE_BASE_URL);
		clientKey = key;
	}
	return client;
}
