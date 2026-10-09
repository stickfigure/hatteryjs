import {HttpError} from './HttpError';
import {jsonBody, rawBody, type Body} from './body';
import {abortable, executionScope} from './execution';
import {appendPath, paramEntries, paramStrings, splitUrl} from './url';
import type {AfterResponse, BeforeRequest, Decoder, FetchOptions, HeaderValues, HttpTransport, Interceptor, JsonInput, Next, Params, ParamValue, RawBody} from './types';

interface State {
	readonly url: string;
	readonly method: string;
	readonly headers: Headers;
	readonly params: ReadonlyMap<string, readonly string[] | null>;
	readonly body: Body | undefined;
	readonly transport: HttpTransport;
	readonly before: readonly BeforeRequest[];
	readonly after: readonly AfterResponse[];
	readonly interceptors: readonly Interceptor[];
	readonly options: FetchOptions;
	readonly signal: AbortSignal | undefined;
	readonly timeout: number;
}

/** An immutable, reusable request template. Only terminal methods perform I/O. */
export class HttpRequest {
	#state: State;

	constructor(url: string | URL = '') {
		this.#state = Object.freeze({
			url: String(url), method: 'GET', headers: new Headers(), params: new Map(), body: undefined,
			transport: (url: string, init: RequestInit) => globalThis.fetch(url, init),
			before: [], after: [], interceptors: [], options: {}, signal: undefined, timeout: 0,
		});
	}

	private with(changes: Partial<State>): HttpRequest {
		const request = new HttpRequest();
		request.#state = Object.freeze({...this.#state, ...changes});
		return request;
	}

	/** Replace the URL, preserving separately configured parameters. */
	url(value: string | URL): HttpRequest { return this.with({url: String(value)}); }
	getUrl(): string { return this.#state.url; }

	/** Append literal path fragments, preserving the existing query and fragment. */
	path(...parts: string[]): HttpRequest { return this.with({url: appendPath(this.#state.url, parts)}); }

	/** Append encoded identifiers. Dot-only segments are rejected because URLs normalize them. */
	segment(...values: (string | number)[]): HttpRequest {
		const parts = values.map(value => {
			const text = String(value);
			if (!text || text === '.' || text === '..') throw new TypeError('A path segment must be nonempty and cannot be . or ..');
			return encodeURIComponent(text);
		});
		return this.path(...parts);
	}

	method(value: string): HttpRequest { return this.with({method: value.toUpperCase()}); }
	getMethod(): string { return this.#state.method; }
	GET(): HttpRequest { return this.method('GET'); }
	HEAD(): HttpRequest { return this.method('HEAD'); }
	DELETE(): HttpRequest { return this.method('DELETE'); }
	OPTIONS(): HttpRequest { return this.method('OPTIONS'); }

	POST(): HttpRequest;
	POST<T>(value: T & (NoInfer<JsonInput<T>> | {toJSON(): unknown})): HttpRequest;
	POST(value?: unknown): HttpRequest {
		return arguments.length ? this.method('POST').with({body: jsonBody(value)}) : this.method('POST');
	}

	PUT(): HttpRequest;
	PUT<T>(value: T & (NoInfer<JsonInput<T>> | {toJSON(): unknown})): HttpRequest;
	PUT(value?: unknown): HttpRequest {
		return arguments.length ? this.method('PUT').with({body: jsonBody(value)}) : this.method('PUT');
	}

	PATCH(): HttpRequest;
	PATCH<T>(value: T & (NoInfer<JsonInput<T>> | {toJSON(): unknown})): HttpRequest;
	PATCH(value?: unknown): HttpRequest {
		return arguments.length ? this.method('PATCH').with({body: jsonBody(value)}) : this.method('PATCH');
	}

	/** Merge a query parameter. undefined leaves it alone; null or [] removes it. */
	param(key: string, value: ParamValue): HttpRequest {
		if (value === undefined) return this;
		const params = new Map(this.#state.params);
		params.set(key, value === null ? null : paramStrings(value));
		return this.with({params});
	}

	params<T extends object>(values: (T & Params<T>) | URLSearchParams): HttpRequest {
		let request: HttpRequest = this;
		for (const [key, value] of paramEntries(values)) request = request.param(key, value);
		return request;
	}

	/** An independent copy of the effective query, including parameters in the URL. */
	toSearchParams(): URLSearchParams {
		const params = new URLSearchParams(splitUrl(this.#state.url).query);
		for (const [key, values] of this.#state.params) {
			params.delete(key);
			for (const value of values ?? []) params.append(key, value);
		}
		return params;
	}

	toUrl(): string {
		// Preserve exact URL encoding when no parameter edits were requested (eg, signed URLs).
		if (!this.#state.params.size) return this.#state.url;
		const {path, hash} = splitUrl(this.#state.url);
		const query = this.toSearchParams().toString();
		return path + (query ? '?' + query : '') + hash;
	}

	/** Case-insensitive replacement. null removes a header; undefined leaves it alone. */
	header(key: string, value: string | null | undefined): HttpRequest {
		if (value === undefined) return this;
		const headers = new Headers(this.#state.headers);
		if (value === null) headers.delete(key); else headers.set(key, value);
		return this.with({headers});
	}

	headers<T extends object>(values: (T & HeaderValues<T>) | Headers): HttpRequest {
		let request: HttpRequest = this;
		const entries = values instanceof Headers ? values.entries() : Object.entries(values as HeaderValues);
		for (const [key, value] of entries) request = request.header(key, value);
		return request;
	}

	/** An independent copy, including the inferred body content type. */
	getHeaders(): Headers {
		const headers = new Headers(this.#state.headers);
		if (!headers.has('content-type') && this.#state.body?.contentType) headers.set('content-type', this.#state.body.contentType);
		return headers;
	}

	contentType(value: string | null): HttpRequest { return this.header('content-type', value); }
	bearerAuth(token: string): HttpRequest { return this.header('authorization', `Bearer ${token}`); }
	basicAuth(username: string, password: string): HttpRequest {
		const bytes = new TextEncoder().encode(`${username}:${password}`);
		const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
		return this.header('authorization', `Basic ${btoa(binary)}`);
	}

	/** Snapshot a JSON body now. null is JSON null, not an absent body. */
	body<T>(value: T & (NoInfer<JsonInput<T>> | {toJSON(): unknown})): HttpRequest { return this.with({body: jsonBody(value)}); }

	/** Explicit application/x-www-form-urlencoded body; query parameters remain in the URL. */
	form<T extends object>(values: (T & Params<T>) | URLSearchParams): HttpRequest {
		const params = new URLSearchParams();
		for (const [key, value] of paramEntries(values)) {
			if (value != null) for (const entry of paramStrings(value)) params.append(key, entry);
		}
		return this.with({body: rawBody(params.toString(), 'application/x-www-form-urlencoded;charset=UTF-8')});
	}

	/** Snapshot a native body. For FormData, let fetch generate the multipart boundary. null clears the body. */
	rawBody(value: RawBody | null, contentType?: string): HttpRequest {
		return this.with({body: value === null ? undefined : rawBody(value, contentType)});
	}

	/** Native fetch options, merged with inherited defaults. Core request fields use their fluent methods. */
	fetchOptions(options: FetchOptions): HttpRequest { return this.with({options: Object.freeze({...this.#state.options, ...options})}); }
	transport(transport: HttpTransport): HttpRequest { return this.with({transport}); }
	signal(signal: AbortSignal | undefined): HttpRequest { return this.with({signal}); }

	/** Milliseconds, or 0 to disable. Starts after beforeRequest; shortcuts include body reading/decoding. */
	timeout(milliseconds: number): HttpRequest {
		if (!Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > 2_147_483_647) throw new RangeError('timeout must be an integer from 0 to 2147483647 milliseconds');
		return this.with({timeout: milliseconds});
	}

	/** Append an async-capable hook. Returning nothing keeps the request unchanged. */
	beforeRequest(hook: BeforeRequest): HttpRequest { return this.with({before: [...this.#state.before, hook]}); }
	/** Append a hook for the resolved response. Read response.clone() if the body is needed downstream. */
	afterResponse(hook: AfterResponse): HttpRequest { return this.with({after: [...this.#state.after, hook]}); }
	/** Append middleware. The first registered interceptor is outermost. next() awaits response headers. */
	intercept(interceptor: Interceptor): HttpRequest { return this.with({interceptors: [...this.#state.interceptors, interceptor]}); }

	/** Fresh fetch options for inspection or a custom transport. Does not execute hooks or start a timeout. */
	toRequestInit(): RequestInit {
		const init: RequestInit = {...this.#state.options, method: this.#state.method, headers: this.getHeaders()};
		if (this.#state.signal) init.signal = this.#state.signal;
		if (this.#state.body) init.body = this.#state.body.create();
		return init;
	}

	/** Native response, including non-2xx statuses. Resolves when response headers arrive. */
	fetch(): Promise<Response> { return this.execute(async response => response); }

	/** Checked JSON. Without a decoder, T is a type assertion; the default is unknown. */
	json<T = unknown>(): Promise<T>;
	json<T>(decoder: Decoder<T>): Promise<T>;
	json<T>(decoder?: Decoder<T>): Promise<T> {
		return this.checked(async response => {
			const value: unknown = await response.json();
			return decode(value, decoder);
		});
	}

	/** Like json(), but returns null for 204, 205, and HEAD. Malformed or unexpected empty JSON still throws. */
	jsonOrNull<T = unknown>(): Promise<T | null>;
	jsonOrNull<T>(decoder: Decoder<T>): Promise<T | null>;
	jsonOrNull<T>(decoder?: Decoder<T>): Promise<T | null> {
		return this.checked(async (response, request) => {
			if (response.status === 204 || response.status === 205 || request.getMethod() === 'HEAD') return null;
			const value: unknown = await response.json();
			return decode(value, decoder);
		});
	}

	text(): Promise<string> { return this.checked(response => response.text()); }
	blob(): Promise<Blob> { return this.checked(response => response.blob()); }
	arrayBuffer(): Promise<ArrayBuffer> { return this.checked(response => response.arrayBuffer()); }
	/** Check success and release the unused response body. */
	success(): Promise<void> { return this.checked(async response => { await response.body?.cancel(); }); }

	private checked<T>(consume: (response: Response, request: HttpRequest) => Promise<T>): Promise<T> {
		return this.execute((response, request) => {
			if (!response.ok) throw new HttpError(response, request);
			return consume(response, request);
		});
	}

	private async execute<T>(consume: (response: Response, request: HttpRequest) => Promise<T>): Promise<T> {
		let request: HttpRequest = this;
		for (const hook of this.#state.before) {
			request = (await abortable(() => hook(request), request.#state.signal)) ?? request;
		}
		const scope = executionScope(request.#state.signal, request.#state.timeout);
		request = request.signal(scope.signal);
		try {
			let sentRequest = request;
			let next: Next = async req => {
				if (req.#state.body && (req.getMethod() === 'GET' || req.getMethod() === 'HEAD')) throw new TypeError('GET and HEAD requests cannot have a body; select POST(), PUT(), PATCH(), or another method.');
				const init = req.toRequestInit();
				if (scope.signal) init.signal = req.#state.signal && req.#state.signal !== scope.signal ? AbortSignal.any([scope.signal, req.#state.signal]) : scope.signal;
				sentRequest = req.signal(init.signal ?? undefined);
				return abortable(() => req.#state.transport(req.toUrl(), init), init.signal ?? undefined);
			};
			for (const interceptor of [...request.#state.interceptors].reverse()) {
				const inner = next;
				next = req => Promise.resolve().then(() => interceptor(req, inner));
			}
			let response = await abortable(() => next(request), scope.signal);
			for (const hook of request.#state.after) response = (await abortable(() => hook(response, sentRequest), scope.signal)) ?? response;
			return await abortable(() => consume(response, sentRequest), scope.signal);
		} finally {
			scope.dispose();
		}
	}
}

async function decode<T>(value: unknown, decoder?: Decoder<T>): Promise<T> {
	if (!decoder) return value as T;
	return typeof decoder === 'function' ? decoder(value) : decoder.parse(value);
}
