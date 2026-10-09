import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import type * as Hattery from '../src/index.js';

test('package import and require share the same ESM implementation', async () => {
	const require = createRequire(import.meta.url);
	// Resolve the built package at runtime; source types keep clean-checkout typecheck independent of dist.
	const packageName = 'hattery';
	const {HTTP, HttpError, HttpRequest}: typeof Hattery = await import(packageName);
	const commonjs: typeof Hattery = require(packageName);
	assert.equal(commonjs.HTTP, HTTP);
	assert.equal(commonjs.HttpRequest, HttpRequest);
	assert.equal(commonjs.HttpError, HttpError);
	for (const api of [HTTP, commonjs.HTTP]) {
		assert.deepEqual(await api.transport(async () => Response.json({ok: true})).json(), {ok: true});
		await assert.rejects(api.transport(async () => new Response(null, {status: 404})).success(), HttpError);
	}
});
