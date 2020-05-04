import {Base64} from 'js-base64';
import {HttpResponse, HttpTransport} from "./HttpResponse";

type Params = Record<string, string[]>;
type Headers = Record<string, string>;

export class HttpRequest {
	constructor(
			private _transport: HttpTransport,
			private _method: string,
			private _url: string,
			private _headers: Headers,
			private _params: Params,
	) {
	}

	getTransport(): HttpTransport {
		return this._transport;
	}

	transport(transport: HttpTransport): HttpRequest {
		return new HttpRequest(transport, this._method, this._url, this._headers, this._params);
	}

	getMethod(): string {
		return this._method;
	}

	/**
	 * Return a new request whose method has been changed.
	 */
	method(method: string): HttpRequest {
		return new HttpRequest(this._transport, method, this._url, this._headers, this._params);
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
		return new HttpRequest(this._transport, this._method, url, this._headers, this._params);
	}

	/**
	 * Return a request whose url has been modified to append the specified path.
	 * @param path may have an optional leading '/'. Slash separators will be added between path segments either way.
	 */
	path(path: string): HttpRequest {
		return new HttpRequest(this._transport, this._method, concatPath(this._url, path), this._headers, this._params);
	}

	getHeaders(): Headers {
		return this._headers;
	}

	/**
	 * Return a request with an extra header added to the list that will be sent to the server.
	 */
	header(key: string, value: string) {
		return new HttpRequest(this._transport, this._method, this._url, concatHeader(this._headers, key, value), this._params);
	}

	/**
	 * Shortcut for header('Content-Type', value)
	 */
	contentType(value: string) {
		return this.header('Content-Type', value);
	}

	/**
	 * Return a request with a basic auth header added
	 */
	basicAuth(username: string, password: string) {
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
	param(key: string, value: string | string[] | null) {
		return new HttpRequest(this._transport, this._method, this._url, this._headers, concatParam(this._params, key, value));
	}

	/**
	 * Execute this request.
	 */
	fetch(): HttpResponse {
		return this._transport.fetch(this);
	}

	/** @return the fully formed URL, including any query string parameters, encoded properly */
	toUrl(): string {
		const query = new URLSearchParams();
		for (const key of Object.keys(this._params)) {
			for (const value of this._params[key]) {
				query.append(key, value);
			}
		}

		const queryString = query.toString();

		if (queryString.length > 0) {
			return this._url + '?' + queryString;
		} else {
			return this._url;
		}
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

function concatParam(params: Params, key: string, value: string | string[] | null): Params {
	if (value === null) {
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