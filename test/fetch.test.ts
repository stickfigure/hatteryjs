import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {after, before, test} from 'node:test';
import {HTTP, HttpError} from '../lib';

interface Echo {
	method: string;
	url: string;
	headers: Record<string, string>;
	body: string;
}

const server = createServer(async (request, response) => {
	if (request.url === '/slow-headers') {
		setTimeout(() => response.end('slow'), 200).unref();
		return;
	}
	if (request.url === '/slow-body') {
		response.writeHead(200, {'content-type': 'application/json'});
		response.write('{"ok":');
		setTimeout(() => response.end('true}'), 200).unref();
		return;
	}
	if (request.url === '/redirect') {
		response.writeHead(302, {location: '/echo'}).end();
		return;
	}
	const chunks: Buffer[] = [];
	for await (const chunk of request) chunks.push(Buffer.from(chunk));
	response.writeHead(200, {'content-type': 'application/json', 'x-request-id': 'local-test'});
	response.end(JSON.stringify({method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString()}));
});

let origin: string;
before(async () => {
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');
	const address = server.address();
	assert.ok(address && typeof address !== 'string');
	origin = `http://127.0.0.1:${address.port}`;
});
after(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('native fetch sends the expected method, path, query, headers, and JSON body', async () => {
	const result = await HTTP.url(`${origin}/api?sort=name#top`).path('users').segment('a/b')
		.params({active: true, page: 2}).bearerAuth('token').POST({name: 'Ada'}).json<Echo>();
	assert.equal(result.method, 'POST');
	assert.equal(result.url, '/api/users/a%2Fb?sort=name&active=true&page=2');
	assert.equal(result.headers.authorization, 'Bearer token');
	assert.equal(result.headers['content-type'], 'application/json');
	assert.equal(result.body, '{"name":"Ada"}');
});

test('native fetch sends JSON null, form bodies, and raw text distinctly', async () => {
	const base = HTTP.url(`${origin}/echo`).POST().param('source', 'web');
	assert.equal((await base.body(null).json<Echo>()).body, 'null');
	const form = await base.form({name: 'Ada Lovelace', tag: ['a', 'b']}).json<Echo>();
	assert.equal(form.url, '/echo?source=web');
	assert.equal(form.body, 'name=Ada+Lovelace&tag=a&tag=b');
	assert.match(form.headers['content-type'] ?? '', /^application\/x-www-form-urlencoded/);
	const raw = await base.rawBody('hello', 'text/plain').json<Echo>();
	assert.equal(raw.body, 'hello');
	assert.equal(raw.headers['content-type'], 'text/plain');
});

test('multipart uploads retain files and let fetch generate the boundary', async () => {
	const form = new FormData();
	form.append('name', 'Ada');
	form.append('file', new Blob(['hello']), 'greeting.txt');
	const request = HTTP.url(`${origin}/upload`).POST().rawBody(form);
	form.set('name', 'mutated');
	for (const response of await Promise.all([request.json<Echo>(), request.json<Echo>()])) {
		assert.match(response.headers['content-type'] ?? '', /^multipart\/form-data; boundary=/);
		assert.match(response.body, /filename="greeting.txt"/);
		assert.match(response.body, /Ada/);
		assert.doesNotMatch(response.body, /mutated/);
		assert.match(response.body, /hello/);
	}
});

test('native response headers and redirect controls are available', async () => {
	const response = await HTTP.url(`${origin}/echo`).fetch();
	assert.equal(response.headers.get('x-request-id'), 'local-test');
	await response.body?.cancel();
	const redirect = HTTP.url(`${origin}/redirect`).fetchOptions({redirect: 'manual'});
	assert.equal((await redirect.fetch()).status, 302);
	await assert.rejects(redirect.success(), HttpError);
	assert.equal((await redirect.fetchOptions({redirect: 'follow'}).json<Echo>()).url, '/echo');
});

test('native network timeouts cover both response headers and shortcut body reads', async () => {
	await assert.rejects(HTTP.url(`${origin}/slow-headers`).timeout(30).fetch(), {name: 'TimeoutError'});
	await assert.rejects(HTTP.url(`${origin}/slow-body`).timeout(30).json(), {name: 'TimeoutError'});
});

test('caller cancellation still reaches a native response body after fetch returns', async () => {
	const controller = new AbortController();
	const response = await HTTP.url(`${origin}/slow-body`).timeout(5_000).signal(controller.signal).fetch();
	const reading = response.json();
	controller.abort();
	await assert.rejects(reading, {name: 'AbortError'});
});
