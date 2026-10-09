// Resolve the built package through its exports, without importing library source.
// Compiled both as a Node-only ESM consumer and as a browser bundler consumer.
import {HTTP, HttpError, HttpRequest, type HttpTransport, type RawBody} from 'hattery';

const bodies: RawBody[] = [
	'hello',
	new Blob(['hello']),
	new File(['hello'], 'hello.txt'),
	new FormData(),
	new URLSearchParams({name: 'Ada'}),
	new ArrayBuffer(4),
	new Uint8Array([1, 2]),
	new DataView(new ArrayBuffer(4)),
	new Uint8Array(new SharedArrayBuffer(4)),
];
const transport: HttpTransport = fetch;
const base: HttpRequest = HTTP.url('https://example.com').transport(transport);
for (const body of bodies) base.POST().rawBody(body);
const init: RequestInit = base.toRequestInit();
const response: Promise<Response> = base.fetch();
const json: Promise<{id: number}> = base.json<{id: number}>();
const checked: Promise<void> = base.success();
const error = new HttpError(new Response(null, {status: 404}), base);
const errorResponse: Response = error.response;

// @ts-expect-error One-shot streams are not reusable bodies in either environment.
base.rawBody(new ReadableStream());
// @ts-expect-error Arbitrary objects use the JSON body API.
base.rawBody({name: 'Ada'});
// @ts-expect-error Node fetch supports iterables, but Hattery requires reusable bodies.
base.rawBody([new Uint8Array([1])]);

async function* chunks() { yield new Uint8Array([1]); }
// @ts-expect-error Async iterables are also one-shot upload bodies.
base.rawBody(chunks());
