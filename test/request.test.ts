import assert from 'node:assert/strict';
import {test} from 'node:test';
import {HTTP, HttpRequest, type FetchOptions} from '../src/index.js';

test('templates remain independent across URL, method, parameters, and headers', () => {
	const tags = ['one'];
	const base = HTTP.url('https://example.com/api').header('X-Test', 'base').param('tag', tags);
	const child = base.path('/users', 'active/').POST({name: 'Ada'}).param('page', 2).header('x-test', 'child');
	tags.push('two');
	child.getHeaders().set('x-test', 'mutated');
	child.toSearchParams().append('tag', 'mutated');
	assert.equal(base.toUrl(), 'https://example.com/api?tag=one');
	assert.equal(base.getMethod(), 'GET');
	assert.equal(base.getHeaders().get('x-test'), 'base');
	assert.equal(child.getHeaders().get('X-Test'), 'child');
	assert.equal(child.toUrl(), 'https://example.com/api/users/active/?tag=one&page=2');
	assert.equal(HTTP.toUrl(), '');
});

test('URL objects are snapshotted and url() preserves explicit parameter overrides', () => {
	const url = new URL('https://example.com/one?old=true');
	const request = new HttpRequest(url).param('page', 2);
	url.pathname = '/changed';
	assert.equal(request.toUrl(), 'https://example.com/one?old=true&page=2');
	assert.equal(request.url('/two?new=true').toUrl(), '/two?new=true&page=2');
});

test('path appends before query and fragment and preserves slash conventions', () => {
	const base = HTTP.url('https://example.com/api/?sort=name#top');
	assert.equal(base.path('/users/', '/active').toUrl(), 'https://example.com/api/users/active?sort=name#top');
	assert.equal(HTTP.url('/api').path('users').toUrl(), '/api/users');
	assert.equal(HTTP.path('api', '/users').toUrl(), 'api/users');
	assert.equal(base.path('').toUrl(), base.toUrl());
	assert.throws(() => base.path('users?sort=name'), TypeError);
	assert.throws(() => base.path('users#top'), TypeError);
});

test('dynamic segments encode delimiters and reject URL-normalized dot segments', () => {
	assert.equal(HTTP.url('/users').segment('a/b ?#%', 42).toUrl(), '/users/a%2Fb%20%3F%23%25/42');
	for (const segment of ['', '.', '..']) assert.throws(() => HTTP.segment(segment), TypeError);
});

test('query parameters merge with URL parameters and preserve fragments', () => {
	const base = HTTP.url('/items?sort=name&tag=old&remove=yes#top');
	assert.equal(base.params({page: 2, active: false, tag: ['a b', 'c'], remove: null}).toUrl(),
		'/items?sort=name&page=2&active=false&tag=a+b&tag=c#top');
	assert.equal(base.param('sort', undefined).param('tag', []).param('remove', null).toUrl(), '/items?sort=name#top');
	assert.equal(HTTP.url('/items?x=1#top').param('x', null).toUrl(), '/items#top');
	assert.equal(HTTP.url('/items?a=hello%20world').toUrl(), '/items?a=hello%20world');
	assert.equal(HTTP.param('__proto__', 'safe').toSearchParams().get('__proto__'), 'safe');
});

test('URLSearchParams and readonly arrays preserve repeated parameters and are copied', () => {
	const values = new URLSearchParams('tag=a&tag=b');
	const request = HTTP.url('/items').params(values).params({flags: [true, false] as const});
	values.append('tag', 'c');
	assert.equal(request.toUrl(), '/items?tag=a&tag=b&flags=true&flags=false');
});

test('parameters always stay in the URL regardless of HTTP method or body type', () => {
	const request = HTTP.url('/items').param('page', 2);
	for (const variant of [request.POST(), request.POST({name: 'Ada'}), request.POST().form({name: 'Ada'})]) {
		assert.equal(variant.toUrl(), '/items?page=2');
	}
	assert.equal(request.POST().toRequestInit().body, undefined);
	assert.equal(request.POST().getHeaders().get('content-type'), null);
});

test('headers replace case-insensitively, merge in bulk, and support removal', () => {
	const source = new Headers({'X-Other': 'value'});
	const base = HTTP.header('Authorization', 'old').headers(source);
	const changed = base.headers({authorization: 'new', 'x-other': undefined, 'x-extra': 'extra'});
	source.set('x-other', 'changed');
	assert.deepEqual([...changed.getHeaders()], [['authorization', 'new'], ['x-extra', 'extra'], ['x-other', 'value']]);
	assert.equal(changed.header('AUTHORIZATION', null).getHeaders().has('authorization'), false);
	assert.equal(base.getHeaders().get('authorization'), 'old');
	assert.equal(HTTP.POST({x: 1}).header('CONTENT-TYPE', 'custom/type').getHeaders().get('content-type'), 'custom/type');
});

test('auth helpers support bearer tokens and UTF-8 basic credentials', () => {
	assert.equal(HTTP.bearerAuth('token').getHeaders().get('authorization'), 'Bearer token');
	assert.equal(HTTP.basicAuth('Jéff', '秘密').getHeaders().get('authorization'), `Basic ${Buffer.from('Jéff:秘密').toString('base64')}`);
});

test('JSON inputs are snapshotted, including null, primitives, typed interfaces, and dates', () => {
	interface User {name: string; tags?: string[]}
	const user: User = {name: 'Ada', tags: ['one']};
	const request = HTTP.POST(user);
	user.name = 'Grace';
	user.tags?.push('two');
	assert.equal(request.toRequestInit().body, '{"name":"Ada","tags":["one"]}');
	assert.equal(request.getHeaders().get('content-type'), 'application/json');
	for (const value of [null, false, 0, '', 'hello'] as const) assert.equal(HTTP.POST(value).toRequestInit().body, JSON.stringify(value));
	assert.equal(HTTP.POST({at: new Date('2020-01-01T00:00:00Z')}).toRequestInit().body, '{"at":"2020-01-01T00:00:00.000Z"}');
	assert.equal(request.rawBody(null).toRequestInit().body, undefined);
	assert.equal(request.rawBody(null).getHeaders().get('content-type'), null);
});

test('JSON serialization errors happen while building the request', () => {
	const circular: {self?: unknown} = {};
	circular.self = circular;
	// JavaScript callers can bypass the compile-time JSON restriction.
	assert.throws(() => Reflect.apply(HTTP.body, HTTP, [circular]), TypeError);
	assert.throws(() => Reflect.apply(HTTP.body, HTTP, [undefined]), TypeError);
	assert.throws(() => Reflect.apply(HTTP.body, HTTP, [1n]), TypeError);
});

test('form bodies encode scalars and repeated values without moving query parameters', () => {
	const request = HTTP.url('/login?source=web').POST().form({name: 'Ada Lovelace', active: true, tags: [1, 2], absent: undefined, removed: null});
	assert.equal(request.toRequestInit().body, 'name=Ada+Lovelace&active=true&tags=1&tags=2');
	assert.equal(request.toUrl(), '/login?source=web');
	assert.equal(request.getHeaders().get('content-type'), 'application/x-www-form-urlencoded;charset=UTF-8');
	assert.equal(request.form(new URLSearchParams('tag=a&tag=b')).toRequestInit().body, 'tag=a&tag=b');
});

test('raw strings and blobs are not JSON-encoded', async () => {
	assert.equal(HTTP.POST().rawBody('hello', 'text/plain').toRequestInit().body, 'hello');
	const blob = new Blob(['hello'], {type: 'text/plain'});
	assert.equal(await new Response(HTTP.POST().rawBody(blob).toRequestInit().body).text(), 'hello');
	assert.equal(HTTP.POST({x: 1}).rawBody(blob).getHeaders().get('content-type'), null);
});

test('raw byte views preserve byte offsets and are copied on input and output', async () => {
	const source = new Uint8Array([0, 1, 2, 3]);
	const request = HTTP.POST().rawBody(source.subarray(1, 3));
	source[1] = 99;
	const first = request.toRequestInit().body;
	assert.ok(first instanceof ArrayBuffer);
	new Uint8Array(first)[0] = 88;
	assert.deepEqual([...new Uint8Array(await new Response(request.toRequestInit().body).arrayBuffer())], [1, 2]);
});

test('raw shared byte views and DataViews are snapshotted as ordinary buffers', () => {
	for (const buffer of [new ArrayBuffer(4), new SharedArrayBuffer(4)]) {
		const bytes = new Uint8Array(buffer);
		bytes.set([0, 1, 2, 3]);
		for (const view of [bytes.subarray(1, 3), new DataView(buffer, 1, 2)]) {
			const request = HTTP.POST().rawBody(view);
			bytes[1] = 99;
			const body = request.toRequestInit().body;
			assert.ok(body instanceof ArrayBuffer);
			assert.deepEqual([...new Uint8Array(body)], [1, 2]);
			bytes[1] = 1;
		}
	}
});

test('FormData and URLSearchParams bodies are copied on input and each execution', async () => {
	const source = new FormData();
	source.set('name', 'Ada');
	source.append('file', new Blob(['content']), 'example.txt');
	const request = HTTP.POST().rawBody(source);
	source.set('name', 'Grace');
	const first = request.toRequestInit().body;
	assert.ok(first instanceof FormData);
	first.set('name', 'mutated');
	const second = request.toRequestInit().body;
	assert.ok(second instanceof FormData);
	assert.equal(second.get('name'), 'Ada');
	const file = second.get('file');
	assert.ok(file instanceof File);
	assert.equal(file.name, 'example.txt');
	assert.equal(await file.text(), 'content');
	assert.equal(request.getHeaders().get('content-type'), null);
	const params = new URLSearchParams('a=one');
	const encoded = HTTP.POST().rawBody(params);
	params.set('a', 'two');
	assert.equal(await new Response(encoded.toRequestInit().body).text(), 'a=one');
});

test('method helpers and fetch options retain independent defaults', () => {
	assert.equal(HTTP.GET().getMethod(), 'GET');
	assert.equal(HTTP.HEAD().getMethod(), 'HEAD');
	assert.equal(HTTP.DELETE().getMethod(), 'DELETE');
	assert.equal(HTTP.OPTIONS().getMethod(), 'OPTIONS');
	assert.equal(HTTP.PUT({x: 1}).getMethod(), 'PUT');
	assert.equal(HTTP.PATCH({x: 1}).getMethod(), 'PATCH');
	assert.equal(HTTP.method('patch').getMethod(), 'PATCH');
	const options: FetchOptions = {credentials: 'include'};
	const base = HTTP.fetchOptions(options);
	options.credentials = 'omit';
	assert.equal(base.fetchOptions({redirect: 'manual'}).toRequestInit().credentials, 'include');
	assert.equal(base.toRequestInit().redirect, undefined);
	for (const timeout of [-1, NaN, Infinity, 1.5, 2 ** 31]) assert.throws(() => HTTP.timeout(timeout), RangeError);
});
