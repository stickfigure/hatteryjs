import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HTTP} from '../src';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
	return {promise, resolve, reject};
}

test('before hooks compose asynchronously and honor replacement transports', async () => {
	const request = HTTP.url('/users').transport(async () => {throw new Error('old transport');})
		.beforeRequest(async req => req.bearerAuth(await Promise.resolve('token')))
		.beforeRequest(req => {assert.equal(req.getHeaders().get('authorization'), 'Bearer token');})
		.beforeRequest(req => req.transport(async (_, init) => Response.json({auth: new Headers(init.headers).get('authorization')})));
	assert.deepEqual(await request.json(), {auth: 'Bearer token'});
	assert.equal(request.getHeaders().get('authorization'), null);
});

test('interceptors await the actual transport, then response hooks run in registration order', async () => {
	const network = deferred<Response>();
	const started = deferred<void>();
	const events: string[] = [];
	const promise = HTTP.transport(async () => {events.push('network'); started.resolve(); return network.promise;})
		.beforeRequest(() => {events.push('before 1');})
		.beforeRequest(async () => {events.push('before 2');})
		.intercept(async (req, next) => {events.push('outer start'); const response = await next(req); events.push('outer end'); return response;})
		.intercept(async (req, next) => {events.push('inner start'); const response = await next(req); events.push('inner end'); return response;})
		.afterResponse(async response => {events.push('after 1'); assert.deepEqual(await response.clone().json(), {ok: true});})
		.afterResponse(() => {events.push('after 2');})
		.json();
	await started.promise;
	assert.deepEqual(events, ['before 1', 'before 2', 'outer start', 'inner start', 'network']);
	network.resolve(Response.json({ok: true}));
	assert.deepEqual(await promise, {ok: true});
	assert.deepEqual(events, ['before 1', 'before 2', 'outer start', 'inner start', 'network', 'inner end', 'outer end', 'after 1', 'after 2']);
});

test('interceptors can catch asynchronous transport failures and retry with modified requests', async () => {
	let calls = 0;
	const failure = new TypeError('offline');
	const request = HTTP.transport(async (_, init) => {
		if (++calls === 1) { await Promise.resolve(); throw failure; }
		assert.equal(new Headers(init.headers).get('x-retry'), 'yes');
		return Response.json({ok: true});
	}).intercept(async (req, next) => {
		try {return await next(req);} catch (error) {
			assert.equal(error, failure);
			return next(req.header('x-retry', 'yes'));
		}
	});
	assert.deepEqual(await request.json(), {ok: true});
	assert.equal(calls, 2);
});

test('interceptors can short-circuit and response hooks can replace responses', async () => {
	const request = HTTP.transport(async () => {throw new Error('should not send');})
		.intercept(() => new Response('cached', {status: 200}))
		.afterResponse(async response => new Response((await response.text()).toUpperCase()));
	assert.equal(await request.text(), 'CACHED');
});

test('hook failures reject the terminal promise and do not run later hooks', async () => {
	const error = new Error('hook failed');
	let sent = false;
	const request = HTTP.transport(async () => {sent = true; return new Response();})
		.beforeRequest(() => {throw error;});
	await assert.rejects(request.fetch(), value => value === error);
	assert.equal(sent, false);
});

test('request templates support concurrent independent executions', async () => {
	let token = 0;
	const base = HTTP.url('/users').beforeRequest(req => req.bearerAuth(String(++token)))
		.transport(async (url, init) => Response.json({url, auth: new Headers(init.headers).get('authorization')}));
	const result = await Promise.all([base.param('page', 1).json(), base.param('page', 2).json()]);
	assert.deepEqual(result, [{url: '/users?page=1', auth: 'Bearer 1'}, {url: '/users?page=2', auth: 'Bearer 2'}]);
	assert.equal(base.getHeaders().has('authorization'), false);
	assert.equal(base.toUrl(), '/users');
});

test('GET and HEAD with a body reject before calling even custom transports', async () => {
	for (const method of ['GET', 'HEAD']) {
		await assert.rejects(HTTP.method(method).body({x: 1}).transport(async () => {throw new Error('sent');}).fetch(), /cannot have a body/);
	}
});
