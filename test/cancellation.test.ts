import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {HTTP} from '../lib';

test('an already aborted request performs no hooks or network work', async () => {
	const controller = new AbortController();
	const reason = new Error('cancelled');
	controller.abort(reason);
	let ran = false;
	const request = HTTP.signal(controller.signal).beforeRequest(() => {ran = true;})
		.transport(async () => {ran = true; return new Response();});
	await assert.rejects(request.fetch(), error => error === reason);
	assert.equal(ran, false);
});

test('caller cancellation interrupts an async before hook', async () => {
	const controller = new AbortController();
	const request = HTTP.signal(controller.signal).beforeRequest(() => new Promise(() => {}));
	const pending = request.fetch();
	controller.abort(new Error('stop auth'));
	await assert.rejects(pending, /stop auth/);
});

test('timeouts abort the transport signal even when a custom transport ignores cancellation', async () => {
	let signal: AbortSignal | null | undefined;
	const request = HTTP.timeout(20).transport(async (_, init) => {signal = init.signal; return new Promise(() => {});});
	await assert.rejects(request.fetch(), {name: 'TimeoutError'});
	assert.equal(signal?.aborted, true);
});

test('caller signals combine with timeouts and preserve the original abort reason', async () => {
	const controller = new AbortController();
	const reason = new Error('user cancelled');
	let observed: AbortSignal | null | undefined;
	let started!: () => void;
	const ready = new Promise<void>(resolve => {started = resolve;});
	const pending = HTTP.timeout(10_000).signal(controller.signal).transport(async (_, init) => {
		observed = init.signal;
		started();
		return new Promise(() => {});
	}).fetch();
	await ready;
	controller.abort(reason);
	await assert.rejects(pending, error => error === reason);
	assert.equal(observed?.reason, reason);
});

test('shortcut timeouts include response body reads, response hooks, and async decoders', async () => {
	await assert.rejects(HTTP.timeout(20).transport(async () => new Response(new ReadableStream())).json(), {name: 'TimeoutError'});
	await assert.rejects(HTTP.timeout(20).transport(async () => Response.json({}))
		.afterResponse(() => new Promise(() => {})).fetch(), {name: 'TimeoutError'});
	await assert.rejects(HTTP.timeout(20).transport(async () => Response.json({}))
		.json(() => new Promise(() => {})), {name: 'TimeoutError'});
});

test('each execution has a fresh timeout and completed operations clean up their timers', async () => {
	const signals: AbortSignal[] = [];
	const request = HTTP.timeout(20).transport(async (_, init) => {
		assert.ok(init.signal);
		signals.push(init.signal);
		return new Response('ok');
	});
	assert.equal(await request.text(), 'ok');
	await delay(30);
	assert.equal(await request.text(), 'ok');
	assert.notEqual(signals[0], signals[1]);
	assert.equal(signals[0]?.aborted, false);
});

test('timeout and signal supplied by a before hook are honored', async () => {
	await assert.rejects(HTTP.beforeRequest(request => request.timeout(20))
		.transport(async () => new Promise(() => {})).fetch(), {name: 'TimeoutError'});
	const controller = new AbortController();
	controller.abort(new Error('hook signal'));
	await assert.rejects(HTTP.beforeRequest(request => request.signal(controller.signal)).fetch(), /hook signal/);
});
