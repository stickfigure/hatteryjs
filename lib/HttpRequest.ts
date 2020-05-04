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

	method(method: string): HttpRequest {
		return new HttpRequest(this._transport, method, this._url, this._headers, this._params);
	}

	GET(): HttpRequest {
		return this.method('GET');
	}

	POST(): HttpRequest {
		return this.method('POST');
	}

	PUT(): HttpRequest {
		return this.method('PUT');
	}

	DELETE(): HttpRequest {
		return this.method('DELETE');
	}

	HEAD(): HttpRequest {
		return this.method('HEAD');
	}

	PATCH(): HttpRequest {
		return this.method('PATCH');
	}

	getUrl(): string {
		return this._url;
	}

	url(url: string): HttpRequest {
		return new HttpRequest(this._transport, this._method, url, this._headers, this._params);
	}

	path(path: string): HttpRequest {
		return new HttpRequest(this._transport, this._method, concatPath(this._url, path), this._headers, this._params);
	}

	getHeaders(): Headers {
		return this._headers;
	}

	header(key: string, value: string) {
		return new HttpRequest(this._transport, this._method, this._url, concatHeader(this._headers, key, value), this._params);
	}

	contentType(value: string) {
		return this.header('Content-Type', value);
	}

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

	param(key: string, value: string | string[]) {
		return new HttpRequest(this._transport, this._method, this._url, this._headers, concatParam(this._params, key, value));
	}

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

function concatParam(params: Params, key: string, value: string | string[]): Params {
	const array = Array.isArray(value) ? value : [value];
	const obj = {...params};
	obj[key] = array;
	return obj;
}