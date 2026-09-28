import { json } from '@sveltejs/kit';
import { StoreError } from './store';
import { ConfigError } from './runner';

/** Wrap a handler so storage / config errors become JSON error responses. */
export async function handle<T>(fn: () => Promise<T>): Promise<Response> {
	try {
		const out = await fn();
		return out instanceof Response ? out : json(out ?? { ok: true });
	} catch (err) {
		if (err instanceof StoreError) return json({ error: err.message }, { status: err.status });
		if (err instanceof ConfigError) return json({ error: err.message }, { status: 500 });
		console.error(err);
		return json({ error: (err as Error).message ?? String(err) }, { status: 500 });
	}
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await request.json();
		if (body && typeof body === 'object' && !Array.isArray(body)) return body;
	} catch {
		// fall through
	}
	throw new StoreError('Request body must be a JSON object.', 400);
}
