import {Base64} from 'js-base64';
import {HttpResponse, HttpResponseWrapper, HttpTransport} from "./HttpResponse";

type Params = Record<string, string[]>;
type Headers = Record<string, string>;
type Preflight = (request: HttpRequest) => HttpRequest;
type Postflight = (response: Promise<HttpResponse>) => Promise<HttpResponse>;
type Processor = (request: HttpRequest) => Promise<HttpResponse>
type Interceptor = (request: HttpRequest, proceed: Processor) => Promise<HttpResponse>

export class HttpRequest {
	constructor(
			private _transport: HttpTransport,
			private _method: string,
			private _url: string,
			private _headers: Headers,
			private _params: Params,
			private _preflight: Preflight,
			private _postflight: Postflight,
			private _interceptor: Interceptor,
			private _body: unknown,
	) {
	}

	getTransport(): HttpTransport {
		return this._transport;
	}

	transport(transport: HttpTransport): HttpRequest {
		return new HttpRequest(transport, this._method, this._url, this._headers, this._params, this._preflight, this._postflight, this._interceptor, this._body);
	}

	getMethod(): string {
		return this._method;
	}

	/**
	 * Return a new request whose method has been changed.
	 */
	method(method: string): HttpRequest {
		return new HttpRequest(this._transport, method, this._url, this._headers, this._params, this._preflight, this._postflight, this._interceptor, this._body);
	}

	/** Shortcut for method('GET') */
	GET(): HttpRequest {
		return this.method('GET');
	}

	/** Shortcut for method('POST') */
	POST(): HttpRequest {
		return this.method('POST');
	}

	/** Shortcut for method('PUT') */
	PUT(): HttpRequest {
		return this.method('PUT');
	}

	/** Shortcut for method('DELETE') */
	DELETE(): HttpRequest {
		return this.method('DELETE');
	}

	/** Shortcut for method('HEAD') */
	HEAD(): HttpRequest {
		return this.method('HEAD');
	}

	/** Shortcut for method('PATCH') */
	PATCH(): HttpRequest {
		return this.method('PATCH');
	}

	/** @return the url part built up so far, including paths. Does not include the query string. */
	getUrl(): string {
		return this._url;
	}

	/**
	 * Return a request whose url (and paths) have been replaced with the specified value
	 */
	url(url: string): HttpRequest {
		return new HttpRequest(this._transport, this._method, url, this._headers, this._params, this._preflight, this._postflight, this._interceptor, this._body);
	}

	/**
	 * Return a request whose url has been modified to append the specified path.
	 * @param path may have an optional leading '/'. Slash separators will be added between path segments either way.
	 */
	path(path: string): HttpRequest {
		return new HttpRequest(this._transport, this._method, concatPath(this._url, path), this._headers, this._params, this._preflight, this._postflight, this._interceptor, this._body);
	}

	getHeaders(): Headers {
		return this._headers;
	}

	/**
	 * Return a request with an extra header added to the list that will be sent to the server.
	 */
	header(key: string, value: string): HttpRequest {
		return new HttpRequest(this._transport, this._method, this._url, concatHeader(this._headers, key, value), this._params, this._preflight, this._postflight, this._interceptor, this._body);
	}

	/**
	 * Shortcut for header('Content-Type', value)
	 */
	contentType(value: string): HttpRequest {
		return this.header('Content-Type', value);
	}

	/**
	 * Return a request with a basic auth header added
	 */
	basicAuth(username: string, password: string): HttpRequest {
		const basic = username + ':' + password;

		// Seems like we are going to have problems with nonascii chars?
		// const encoder = new TextEncoder();
		// const array = encoder.encode(basic);

		return this.header("Authorization", "Basic " + Base64.encode(basic));
	}

	getParams(): Params {
		return this._params;
	}

	/**
	 * Return a request which will have an extra parameter added. If this is a POST and there is otherwise no body
	 * specified, the content type will be application/x-www-form-urlencoded and these parameters will become the body.
	 * Otherwise these become query parameters.
	 *
	 * The keys and values will be urlencoded for you.
	 *
	 * Calling this method repeatedly with the same key will replace the value. To specify repeated parameter values,
	 * provide a string[] value. Providing a null value will clear the query key.
	 */
	param(key: string, value?: string | string[] | null): HttpRequest {
		return new HttpRequest(this._transport, this._method, this._url, this._headers, concatParam(this._params, key, value), this._preflight, this._postflight, this._interceptor, this._body);
	}

	/**
	 * Return a request which combines these parameters with the existing set. Replaces any keys specified, although
	 * it does not replace *all* parameters. It is a shorthand for calling param() with each key/value.
	 * @param values a set of key/values to replace in our set
	 */
	params(values: Record<string, string | string[] | null | undefined>): HttpRequest {
		let here: HttpRequest = this;
		for (const key of Object.keys(values)) {
			here = here.param(key, values[key]);
		}

		return here;
	}

	/**
	 * Return a request that has a preflight interceptor (replacing any preflight function that already exists).
	 * Before fetching, the interceptor will be allowed to inspect the request and return a new one. To reset
	 * the preflight, pass in the identity function (req => req).
	 */
	preflight(func: Preflight) {
		return new HttpRequest(this._transport, this._method, this._url, this._headers, this._params, func, this._postflight, this._interceptor, this._body);
	}

	/**
	 * Return a request that chains a new preflight interceptor to the current interceptor. If no preflight interceptor
	 * has already been set, this is the same as preflight().
	 */
	preflightAndThen(func: Preflight): HttpRequest {
		const combined: Preflight = (req: HttpRequest) => {
			const before = this._preflight(req);
			return func(before);
		}

		return new HttpRequest(this._transport, this._method, this._url, this._headers, this._params, combined, this._postflight, this._interceptor, this._body);
	}

	/**
	 * Return a response that has a postflight interceptor (replacing any postflight function that already exists).
	 * The interceptor will be allowed to inspect the response and return a new one. To reset the postflight, pass
	 * in the identity function (response => response).
	 */
	postflight(func: Postflight): HttpRequest {
		return new HttpRequest(this._transport, this._method, this._url, this._headers, this._params, this._preflight, func, this._interceptor, this._body);
	}

	/**
	 * Return a response that chains a new postflight interceptor to the current interceptor. If no postflight interceptor
	 * has already been set, this is the same as postflight().
	 */
	postflightAndThen(func: Postflight): HttpRequest {
		const combined: Postflight = (resp: Promise<HttpResponse>) => {
			const before = this._postflight(resp);
			return func(before);
		}

		return new HttpRequest(this._transport, this._method, this._url, this._headers, this._params, this._preflight, combined, this._interceptor, this._body);
	}

	/**
	 * Return a response that has a full interceptor (wrapping any interceptor function that already exists).
	 * This is a bit different from the others; interceptors are fired "outer first", and this is a cumulative
	 * operator; there is no "reset interceptors".
	 *
	 * Interceptors are fired after preflights and before postflights.
	 */
	intercept(func: Interceptor): HttpRequest {
		const combined: Interceptor = (request: HttpRequest, proceed: Processor) => {
			return func(request, nextRequest => this._interceptor(nextRequest, proceed));
		}

		return new HttpRequest(this._transport, this._method, this._url, this._headers, this._params, this._preflight, this._postflight, combined, this._body);
	}

	/**
	 * Return a request that will submit the object as JSON body.
	 */
	body(value: unknown): HttpRequest {
		return new HttpRequest(this._transport, this._method, this._url, this._headers, this._params, this._preflight, this._postflight, this._interceptor, value);
	}

	/** */
	getBody(): unknown {
		return this._body;
	}

	/**
	 * Figure out the actual content type, checking for a header first. If no header, guess
	 * based on situation (eg, POST() with params means form).
	 */
	getContentType(): string | null {
		const fromHeader = this._headers['Content-Type'] || this._headers['content-type'];
		if (fromHeader != null) {
			return fromHeader;
		}

		if (this._body != null) {
			return "application/json";
		}

		if (this._method == 'POST') {
			return "application/x-www-form-urlencoded; charset=utf-8";
		}

		return null;
	}

	/** Is this x-www-form-urlencoded */
	isForm(): boolean {
		const ct = this.getContentType();
		return ct != null && ct.startsWith("application/x-www-form-urlencoded");
	}

	/**
	 * Execute this request.
	 */
	fetch(): HttpResponse {
		const preflighted = this._preflight(this);
		const response = this._interceptor(preflighted, req => this._transport.fetch(req));
		return new HttpResponseWrapper(this._postflight(response));
	}

	/**
	 * Shorthand for fetch().success()
	 */
	success(): Promise<void> {
		return this.fetch().success();
	}

	/**
	 * Shorthand for fetch().json()
	 */
	json(): Promise<any> {
		return this.fetch().json();
	}

	/**
	 * Shorthand for fetch().text()
	 */
	text(): Promise<string> {
		return this.fetch().text();
	}

	/** @return the fully formed URL, including any query string parameters, encoded properly */
	toUrl(): string {
		if (this.isForm()) {
			return this._url;
		} else {
			const query = this.toSearchParams();

			const queryString = query.toString();

			if (queryString.length > 0) {
				return this._url + '?' + queryString;
			} else {
				return this._url;
			}
		}
	}

	toSearchParams(): URLSearchParams {
		const query = new URLSearchParams();
		for (const key of Object.keys(this._params)) {
			for (const value of this._params[key]) {
				query.append(key, value);
			}
		}

		return query;
	}
}

/** Check for slashes */
function concatPath(url: string, path: string): string {
	// no .endsWith() or .startsWith in IE
	if (url.charAt(url.length - 1) === '/') {
		return path.charAt(0) === '/' ? (url + path.substring(1)) : (url + path);
	} else {
		return path.charAt(0) === '/' ? (url + path) : (url + '/' + path);
	}
}

function concatHeader(headers: Headers, key: string, value: string): Headers {
	const obj = {...headers};
	obj[key] = value;
	return obj;
}

function concatParam(params: Params, key: string, value?: string | string[] | null): Params {
	if (value == null) {
		const obj = {...params};
		delete obj[key];
		return obj;
	} else {
		const array = Array.isArray(value) ? value : [value];
		const obj = {...params};
		obj[key] = array;
		return obj;
	}
}