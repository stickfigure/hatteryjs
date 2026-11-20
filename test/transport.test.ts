import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HTTP, HttpError, HttpRequest, TransportError} from '../src/index.js';

const readers: [string, (request: HttpRequest) => Promise<unknown>][] = [
	['json', request => request.json()],
	['jsonOrNull', request => request.jsonOrNull()],
	['text', request => request.text()],
	['blob', request => request.blob()],
	['arrayBuffer', request => request.arrayBuffer()],
];
const terminals = [...readers, ['fetch', (request: HttpRequest) => request.fetch()], ['success', (request: HttpRequest) => request.success()]] as const;

function brokenResponse(cause: unknown, status = 200): Response {
	return new Response(new ReadableStream({start(controller) {controller.error(cause);}}), {
		status, headers: {'x-request-id': 'broken-body'},
	});
}

for (const [name, consume] of terminals) {
	test(`${name} normalizes transport rejection with the effective request and original cause`, async () => {
		const cause = new TypeError('connection failed');
		const request = HTTP.url('/original').beforeRequest(req => req.url('/actual').POST())
			.intercept((req, next) => next(req.param('attempt', 2).header('x-attempt', '2')))
			.transport(async () => {throw cause;});
		await assert.rejects(consume(request), error => {
			assert.ok(error instanceof TransportError);
			assert.ok(error instanceof Error);
			assert.equal(error.name, 'TransportError');
			assert.equal(error.phase, 'request');
			assert.equal(error.cause, cause);
			assert.equal(error.method, 'POST');
			assert.equal(error.url, '/actual?attempt=2');
			assert.equal(error.request.getHeaders().get('x-attempt'), '2');
			assert.equal(error.response, undefined);
			assert.match(error.message, /POST.*\/actual\?attempt=2.*headers/);
			return true;
		});
	});
}

for (const [name, consume] of readers) {
	test(`${name} normalizes body read failures with the native response`, async () => {
		const cause = new TypeError('connection lost');
		const response = brokenResponse(cause);
		let sentSignal: AbortSignal | null | undefined;
		const request = HTTP.url('/original').timeout(5_000)
			.intercept((req, next) => next(req.url('/actual').PUT().header('x-attempt', '2')))
			.transport(async (_, init) => {sentSignal = init.signal; return response;});
		await assert.rejects(consume(request), error => {
			assert.ok(error instanceof TransportError);
			assert.equal(error.phase, 'body');
			assert.equal(error.cause, cause);
			assert.equal(error.method, 'PUT');
			assert.equal(error.url, '/actual');
			assert.equal(error.request.getHeaders().get('x-attempt'), '2');
			assert.equal(error.request.toRequestInit().signal, sentSignal);
			assert.equal(error.response, response);
			assert.equal(error.response.headers.get('x-request-id'), 'broken-body');
			assert.match(error.message, /PUT.*\/actual.*body/);
			return true;
		});
	});

	test(`${name} preserves native errors for consumed or locked response bodies`, async () => {
		const consumed = Response.json({ok: true});
		await consumed.text();
		await assert.rejects(consume(HTTP.transport(async () => consumed)), TypeError);
		const locked = Response.json({ok: true});
		const reader = locked.body!.getReader();
		try {
			await assert.rejects(consume(HTTP.transport(async () => locked)), TypeError);
		} finally {
			await reader.cancel();
			reader.releaseLock();
		}
	});
}

test('only JSON readers pass through a SyntaxError from a custom stream', async () => {
	const cause = new SyntaxError('custom stream failed');
	const request = HTTP.transport(async () => brokenResponse(cause));
	for (const [name, consume] of readers) {
		await assert.rejects(consume(request), error => name === 'json' || name === 'jsonOrNull'
			? error === cause
			: error instanceof TransportError && error.cause === cause);
	}
});

test('transport failures include synchronous throws and non-Error rejection causes', async () => {
	for (const cause of [new Error('custom transport'), 'unavailable', null, undefined]) {
		await assert.rejects(HTTP.transport(() => {throw cause;}).fetch(), error => {
			assert.ok(error instanceof TransportError);
			assert.equal(error.cause, cause);
			return true;
		});
	}
});

test('JSON parsing and sync or async decoder errors are not transport errors', async () => {
	for (const consume of [(req: HttpRequest) => req.json(), (req: HttpRequest) => req.jsonOrNull()]) {
		for (const text of ['not JSON', '']) await assert.rejects(consume(HTTP.transport(async () => new Response(text))), SyntaxError);
		assert.deepEqual(await consume(HTTP.transport(async () => new Response('\uFEFF{"name":"Zoë"}'))), {name: 'Zoë'});
	}
	const request = HTTP.transport(async () => Response.json({}));
	for (const cause of [new TypeError('invalid data'), new SyntaxError('decoder syntax'), 'decoder rejection']) {
		for (const decode of [() => {throw cause;}, async () => {throw cause;}]) {
			await assert.rejects(request.json(decode), error => error === cause);
			await assert.rejects(request.jsonOrNull({parse: decode}), error => error === cause);
		}
	}
});

test('hook and interceptor errors propagate unchanged', async () => {
	const cause = new TypeError('application callback');
	const base = HTTP.transport(async () => new Response());
	for (const request of [
		base.beforeRequest(() => {throw cause;}),
		base.afterResponse(() => {throw cause;}),
		base.intercept(() => {throw cause;}),
		base.intercept(async (req, next) => {await next(req); throw cause;}),
		base.transport(async () => brokenResponse(cause)).afterResponse(response => response.text().then(() => {})),
	]) await assert.rejects(request.text(), error => error === cause);
});

test('raw fetch leaves subsequent body errors native and success ignores unused body errors', async () => {
	const cause = new TypeError('connection lost');
	const response = brokenResponse(cause);
	assert.equal(await HTTP.transport(async () => response).fetch(), response);
	await assert.rejects(response.text(), error => error === cause);
	await HTTP.transport(async () => brokenResponse(cause)).success();
});

test('HTTP status checking takes precedence over a broken error response body', async () => {
	for (const [, consume] of readers) {
		const response = brokenResponse(new TypeError('connection lost'), 503);
		await assert.rejects(consume(HTTP.transport(async () => response)), error => {
			assert.ok(error instanceof HttpError);
			assert.equal(error.status, 503);
			assert.equal(error.response, response);
			assert.equal(response.bodyUsed, false);
			return true;
		});
	}
});

test('existing Hattery errors and independent abort or timeout errors are not wrapped', async () => {
	for (const cause of [
		new TransportError(new TypeError('inner transport'), HTTP.url('/inner')),
		new HttpError(new Response(null, {status: 500}), HTTP.url('/inner')),
		new DOMException('aborted elsewhere', 'AbortError'),
		new DOMException('timed out elsewhere', 'TimeoutError'),
		{name: 'AbortError', message: 'from another realm'},
	]) {
		await assert.rejects(HTTP.transport(async () => {throw cause;}).fetch(), error => error === cause);
		await assert.rejects(HTTP.transport(async () => brokenResponse(cause)).text(), error => error === cause);
	}
});

test('cancellation during a body read preserves arbitrary reasons, including interceptor signals', async () => {
	for (const reason of [new TypeError('user cancelled'), 'navigation', null]) {
		const controller = new AbortController();
		let started!: () => void;
		const reading = new Promise<void>(resolve => {started = resolve;});
		let streamController!: ReadableStreamDefaultController;
		const response = new Response(new ReadableStream({
			start(controller) {streamController = controller;},
			pull() {started();},
		}, {highWaterMark: 0}));
		const pending = HTTP.transport(async () => response)
			.intercept((req, next) => next(req.signal(controller.signal))).text();
		await reading;
		controller.abort(reason);
		await assert.rejects(pending, error => error === reason);
		streamController.close();
	}
});

test('interceptors finish before shortcut body reads and do not catch their errors', async () => {
	let caught = false;
	const request = HTTP.transport(async () => brokenResponse(new TypeError('connection lost')))
		.intercept(async (req, next) => {
			try {return await next(req);} catch (error) {caught = true; throw error;}
		});
	await assert.rejects(request.json(), error => error instanceof TransportError && error.phase === 'body');
	assert.equal(caught, false);
});

test('body error context uses the latest attempted request even when an interceptor returns an earlier response', async () => {
	const response = brokenResponse(new TypeError('first response failed'));
	const request = HTTP.transport(async url => url === '/first' ? response : new Response())
		.intercept(async (req, next) => {
			const first = await next(req.url('/first'));
			await next(req.url('/second'));
			return first;
		});
	await assert.rejects(request.text(), error => error instanceof TransportError && error.url === '/second' && error.response === response);
});
