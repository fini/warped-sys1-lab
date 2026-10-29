import { JEV_API_KEY, TYPESAFE_BASE_URL } from '$app/env/private';
import { createClient } from './runner';
import type { TypeSafeClient } from '@typesafe-ai/sdk';

let client: TypeSafeClient | undefined;
let clientKey: string | undefined;

/** Lazily build the SDK client, rebuilding if the key in the environment changes. */
export function getClient(): TypeSafeClient {
	const key = JEV_API_KEY;
	if (!client || key !== clientKey) {
		client = createClient(key, TYPESAFE_BASE_URL);
		clientKey = key;
	}
	return client;
}
