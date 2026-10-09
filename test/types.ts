// Compiled by npm test. These functions are never executed: they exercise the public declarations.
import {HTTP, type HttpRequest, type HttpTransport, type FetchOptions} from '../lib';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T extends true>() {}

interface User {id: number; name: string; tags?: readonly string[]}
interface Filters {page: number; active?: boolean; tags: readonly string[]}
interface CustomHeaders {authorization: string; 'x-optional'?: string}

async function types(user: User, filters: Filters, headers: CustomHeaders) {
	const unknown = await HTTP.json();
	expectType<Equal<typeof unknown, unknown>>();
	// @ts-expect-error JSON without a decoder or type parameter is unknown.
	unknown.name;
	const typed = await HTTP.json<User>();
	expectType<Equal<typeof typed, User>>();
	const nullable = await HTTP.jsonOrNull<User>();
	expectType<Equal<typeof nullable, User | null>>();
	// @ts-expect-error No-content responses require handling null.
	nullable.name;
	const parse = (value: unknown): User => {
		if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'number' || !('name' in value) || typeof value.name !== 'string') throw new Error('Invalid user');
		return {id: value.id, name: value.name};
	};
	const decoded = await HTTP.json(parse);
	expectType<Equal<typeof decoded, User>>();
	const schemaDecoded = await HTTP.json({parse});
	expectType<Equal<typeof schemaDecoded, User>>();
	const asyncDecoded = await HTTP.json(async value => parse(value));
	expectType<Equal<typeof asyncDecoded, User>>();
	const nullableDecoded = await HTTP.jsonOrNull({parse});
	expectType<Equal<typeof nullableDecoded, User | null>>();
	const response = await HTTP.fetch();
	expectType<Equal<typeof response, Response>>();
	// @ts-expect-error fetch is a normal promise, not a response facade.
	HTTP.fetch().json();
	const text = await HTTP.text();
	expectType<Equal<typeof text, string>>();

	HTTP.POST(user).PUT(user).PATCH(user).body(user);
	HTTP.body([user] as const);
	HTTP.body({createdAt: new Date(), optional: undefined});
	HTTP.body({toJSON() {return {name: 'Ada'};}});
	HTTP.params(filters).form(filters).headers(headers);
	HTTP.params({tags: [1, 'two', true] as const, unset: undefined, removed: null});
	HTTP.headers(new Headers()).params(new URLSearchParams()).form(new URLSearchParams());
	HTTP.rawBody(new FormData()).rawBody(new Uint8Array([1])).rawBody(new Blob()).rawBody(null);
	const transport: HttpTransport = fetch;
	HTTP.transport(transport);
	const options: FetchOptions = {credentials: 'include', redirect: 'manual'};
	HTTP.fetchOptions(options);
	HTTP.beforeRequest(async request => request.bearerAuth('token'));
	HTTP.beforeRequest(() => {});
	HTTP.afterResponse(async () => {});
	HTTP.intercept((request, next) => next(request));

	// @ts-expect-error Invalid scalar query parameters cannot silently become [object Object].
	HTTP.param('filter', {name: 'Ada'});
	// @ts-expect-error Bulk parameters have the same restriction.
	HTTP.params({filter: {name: 'Ada'}});
	// @ts-expect-error Form fields must be serializable parameter values.
	HTTP.form({file: new Blob()});
	// @ts-expect-error Header values are strings.
	HTTP.headers({count: 4});
	// @ts-expect-error JSON bodies cannot be undefined.
	HTTP.body(undefined);
	// @ts-expect-error POST(undefined) is different from POST().
	HTTP.POST(undefined);
	// @ts-expect-error BigInt cannot be serialized as JSON.
	HTTP.body({id: 1n});
	// @ts-expect-error Functions must not silently disappear from JSON objects.
	HTTP.body({callback: () => 'lost'});
	// @ts-expect-error Raw upload bodies have their own API.
	HTTP.POST(new FormData());
	// @ts-expect-error Map does not serialize its entries as JSON.
	HTTP.POST(new Map<string, string>());
	// @ts-expect-error Upload streams cannot be reused as immutable request bodies.
	HTTP.rawBody(new ReadableStream());
	// @ts-expect-error Core fields use their explicit fluent methods.
	HTTP.fetchOptions({method: 'POST'});
	const init: RequestInit = {body: 'bypass'};
	// @ts-expect-error Wider variables cannot bypass fluent body handling either.
	HTTP.fetchOptions(init);
	// @ts-expect-error Hooks must return a request or nothing.
	HTTP.beforeRequest(() => 42);
	// @ts-expect-error After hooks receive an actual Response, not a promise wrapper.
	HTTP.afterResponse((response: Promise<Response>) => {});
	// @ts-expect-error Decoders must accept unknown, not assume the input has been validated.
	HTTP.json((input: User) => input.name);
}

// Preserve fluent return types without making the request a thenable.
function builder(request: HttpRequest): HttpRequest {
	// @ts-expect-error Building a request must not make it implicitly executable by Promise.resolve.
	request.then;
	return request.path('users').segment(1).timeout(1000).DELETE();
}
