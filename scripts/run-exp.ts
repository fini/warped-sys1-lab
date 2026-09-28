/**
 * Run an experiment from the terminal.
 *
 *   npm run run-exp -- support-tickets/triage
 *   npm run run-exp -- support-tickets/triage --raw
 *   npm run run-exp -- support-tickets/triage --input double-charge   (fill ${…} from an input set)
 *   npm run run-exp              (lists experiments)
 */
import { existsSync } from 'node:fs';
import { createClient, runExperiment } from '../src/lib/server/runner';
import { listInputSets, listTree, readExperiment, readInputSet, saveResult } from '../src/lib/server/store';
import { findPlaceholders } from '../src/lib/inputs';
import { viewRows } from '../src/lib/views';
import type { Answer } from '../src/lib/types';

if (existsSync('.env')) process.loadEnvFile('.env');

const G = '\x1b[32m', B = '\x1b[1m', D = '\x1b[2m', R = '\x1b[31m', Y = '\x1b[33m', X = '\x1b[0m';
const bar = (p: number, w = 24) => '█'.repeat(Math.round(p * w)).padEnd(w, '░');
const pct = (p: number) => `${(p * 100).toFixed(1).padStart(5)}%`;

function printAnswer(id: string, a: Answer) {
	if (a.type === 'noul') {
		console.log(`  ${B}${id}${X} ${D}noul${X}  ${a.noul >= 0.5 ? G + 'YES' : Y + 'NO '}${X}  ${bar(a.noul)} ${pct(a.noul)}`);
	} else if (a.type === 'choice') {
		console.log(`  ${B}${id}${X} ${D}choice${X}  ${G}${a.choice}${X}  ${D}conf ${a.confidence.toFixed(2)}${X}`);
		for (const [k, p] of Object.entries(a.probabilities).sort((x, y) => y[1] - x[1])) {
			console.log(`      ${(k === a.choice ? G : D) + k.padEnd(16).slice(0, 16)}${X} ${bar(p)} ${pct(p)}`);
		}
	} else {
		console.log(`  ${B}${id}${X} ${D}score${X}  ${G}${a.score.toFixed(2)}${X}  ${D}conf ${a.confidence.toFixed(2)}${X}`);
		for (const [k, p] of Object.entries(a.probabilities)) {
			const legend = typeof a.legend[k] === 'string' ? (a.legend[k] as string) : JSON.stringify(a.legend[k]);
			console.log(`      ${D}${k}${X} ${bar(p)} ${pct(p)}  ${D}${legend.slice(0, 50)}${X}`);
		}
	}
}

const args = process.argv.slice(2);
const target = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--input');
const raw = args.includes('--raw');
const inputAt = args.indexOf('--input');
const inputSet = inputAt >= 0 ? args[inputAt + 1] : undefined;
if (inputAt >= 0 && (!inputSet || inputSet.startsWith('--'))) {
	console.error(`${R}--input needs an input set name${X}`);
	process.exit(1);
}

if (!target) {
	console.log(`${G}Experiments:${X}`);
	for (const p of await listTree()) {
		for (const e of p.experiments) console.log(`  ${p.project}/${e}${p.private ? ' (private)' : ''}`);
	}
	console.log(`\nUsage: npm run run-exp -- <project>/<experiment> [--input <set>] [--raw]`);
	process.exit(0);
}

const [project, name] = target.replace(/\.json$/, '').split('/');
if (!project || !name) {
	console.error(`${R}Expected <project>/<experiment>, got "${target}"${X}`);
	process.exit(1);
}

try {
	const exp = await readExperiment(project, name);
	if (findPlaceholders(exp).length && !inputSet) {
		const sets = await listInputSets(project);
		console.error(`${R}${project}/${name} uses inputs (${findPlaceholders(exp).map((n) => '${' + n + '}').join(', ')}). Pass --input <set>.${X}`);
		if (sets.length) console.error(`${D}input sets in ${project}/: ${sets.join(', ')}${X}`);
		process.exit(1);
	}
	const inputs = inputSet ? { set: inputSet, values: await readInputSet(project, inputSet) } : undefined;
	const client = createClient(process.env.JEV_API_KEY, process.env.TYPESAFE_BASE_URL);
	console.log(`${G}> running ${project}/${name}${X}${exp.name ? ` ${D}(${exp.name})${X}` : ''}${inputSet ? ` ${D}· input ${inputSet}${X}` : ''}`);
	const result = await runExperiment(client, exp, { project, experiment: name }, inputs);
	await saveResult(result);

	if (raw) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		for (const r of result.runs) {
			console.log(`\n${B}# ${r.case}${X} ${D}${r.model ?? ''} · ${r.latencyMs}ms · ${r.usage?.input_tokens ?? '?'} in / ${r.usage?.output_tokens ?? '?'} out${X}`);
			if (r.error) {
				console.log(`  ${R}FAILED${r.error.status ? ` HTTP ${r.error.status}` : ''}: ${r.error.message}${X}`);
				if (r.error.requestId) console.log(`  ${D}request ${r.error.requestId}${X}`);
				continue;
			}
			for (const v of result.input.views ?? []) {
				console.log(`  ${B}${v.title}${X}`);
				for (const row of viewRows(v, r.answers ?? {})) {
					console.log(`      ${row.label.padEnd(16).slice(0, 16)} ${bar(row.value)} ${row.text.padStart(6)}  ${D}${row.level ?? ''}${X}`);
				}
			}
			for (const [id, a] of Object.entries(r.answers ?? {})) printAnswer(id, a);
		}
		console.log(`\n${D}saved results/${project}/${name}/${result.id}.json · total ${result.durationMs}ms${X}`);
	}
	process.exit(result.runs.some((r) => r.error) ? 1 : 0);
} catch (err) {
	console.error(`${R}${(err as Error).message}${X}`);
	process.exit(1);
}
