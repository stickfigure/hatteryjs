import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HTTP, HttpError} from '../lib';

test('fetch returns a real promise of a native Response with status and headers', async () => {
	const pending = HTTP.transport(async () => new Response('missing', {status: 404, headers: {'x-request-id': '123'}})).fetch();
	assert.ok(pending instanceof Promise);
	const response = await pending;
	assert.ok(response instanceof Response);
	assert.equal(response.status, 404);
	assert.equal(response.headers.get('x-request-id'), '123');
	assert.equal(await response.text(), 'missing');
});

test('JSON decoders validate unknown input, infer results, preserve this, and support async work', async () => {
	const request = HTTP.transport(async () => Response.json({name: 'Ada'}));
	const parse = (value: unknown) => {
		assert.ok(typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string');
		return {name: value.name};
	};
	assert.deepEqual(await request.json(parse), {name: 'Ada'});
	assert.equal(await request.json(async value => parse(value).name.length), 3);
	const schema = {prefix: 'Hi ', parse(value: unknown) { return this.prefix + parse(value).name; }};
	assert.equal(await request.json(schema), 'Hi Ada');
	const failure = new Error('invalid user');
	await assert.rejects(request.json(() => {throw failure;}), error => error === failure);
});

test('empty-body behavior is explicit and nullable JSON does not swallow invalid JSON', async () => {
	for (const status of [204, 205]) {
		const request = HTTP.transport(async () => new Response(null, {status}));
		await assert.rejects(request.json(), SyntaxError);
		assert.equal(await request.jsonOrNull(() => {throw new Error('must not decode');}), null);
		assert.equal(await request.text(), '');
		await request.success();
	}
	assert.equal(await HTTP.HEAD().transport(async () => new Response()).jsonOrNull(), null);
	for (const body of ['', 'invalid']) await assert.rejects(HTTP.transport(async () => new Response(body)).jsonOrNull(), SyntaxError);
	assert.equal(await HTTP.transport(async () => Response.json(null)).json(), null);
});

test('all shortcuts check HTTP status and leave an error body available', async () => {
	const request = HTTP.url('https://example.com/users').POST({name: 'Ada'})
		.transport(async () => Response.json({message: 'denied'}, {status: 403}));
	for (const consume of [() => request.json(), () => request.jsonOrNull(), () => request.text(), () => request.blob(), () => request.arrayBuffer(), () => request.success()]) {
		await assert.rejects(consume(), asyncError => {
			assert.ok(asyncError instanceof HttpError);
			assert.equal(asyncError.name, 'HttpError');
			assert.equal(asyncError.status, 403);
			assert.equal(asyncError.method, 'POST');
			assert.equal(asyncError.url, 'https://example.com/users');
			assert.equal(asyncError.response.bodyUsed, false);
			assert.match(asyncError.message, /POST.*403/);
			return true;
		});
	}
	try {
		await request.json();
		assert.fail('Expected HttpError');
	} catch (error) {
		assert.ok(error instanceof HttpError);
		assert.deepEqual(await error.response.json(), {message: 'denied'});
	}
	await assert.rejects(HTTP.transport(async () => new Response(null, {status: 302})).success(), HttpError);
});

test('network errors remain unchanged and checked binary shortcuts work', async () => {
	const failure = new TypeError('connection failed');
	const failed = HTTP.transport(async () => {throw failure;});
	await assert.rejects(failed.json(), error => error === failure);
	await assert.rejects(failed.success(), error => error === failure);
	const request = HTTP.transport(async () => new Response(new Uint8Array([1, 2, 3])));
	assert.deepEqual([...new Uint8Array(await request.arrayBuffer())], [1, 2, 3]);
	assert.equal((await request.blob()).size, 3);
});

test('success cancels the unneeded body rather than downloading it', async () => {
	let cancelled = false;
	await HTTP.transport(async () => new Response(new ReadableStream({cancel() {cancelled = true;}}))).success();
	assert.equal(cancelled, true);
});

test('success completes while another response clone is unread and leaves it usable', async () => {
	const response = new Response('still readable');
	const clone = response.clone();
	try {
		// A bounded request timeout also makes the previous cancellation deadlock fail promptly.
		await HTTP.timeout(1000).transport(async () => clone).success();
		assert.equal(clone.bodyUsed, true);
		assert.equal(response.bodyUsed, false);
		assert.equal(await response.text(), 'still readable');
	} finally {
		if (!response.bodyUsed) await response.body?.cancel();
	}
});

test('success ignores body cleanup rejection', async () => {
	let cancelled = false;
	const response = new Response(new ReadableStream({
		cancel() {
			cancelled = true;
			return Promise.reject(new Error('cleanup failed'));
		},
	}));
	await HTTP.transport(async () => response).success();
	assert.equal(cancelled, true);
	// Let unhandled rejections surface to the test runner.
	await new Promise<void>(resolve => setImmediate(resolve));
});

test('success leaves a body locked by another reader usable', async () => {
	const response = new Response('reader owns this');
	const reader = response.body!.getReader();
	try {
		await HTTP.transport(async () => response).success();
		const {value, done} = await reader.read();
		assert.equal(done, false);
		assert.equal(new TextDecoder().decode(value), 'reader owns this');
	} finally {
		await reader.cancel();
		reader.releaseLock();
	}
});
