import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	JEV_API_KEY: { schema: optional },
	TYPESAFE_BASE_URL: { schema: optional }
});
