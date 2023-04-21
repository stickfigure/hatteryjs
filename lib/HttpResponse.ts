import {HttpRequest} from "./HttpRequest";

export interface HttpTransport {
	fetch(request: HttpRequest): Promise<HttpResponse>;
}

export interface HttpResponse {
	/** @return the status code, whether or not there was success */
	status(): Promise<number>;

	/** Throws HttpError if code is >= 400 */
	success(): Promise<void>;

	/**
	 * 204 NO CONTENT will return null instead of a fetch error
	 * @return the json if success, throws HttpError otherwise
	 */
	json(): Promise<any>;

	/**
	 * 204 NO CONTENT will return null instead of a fetch error
	 * @return the json body whether or not there was success
	 */
	jsonRaw(): Promise<any>;

	/**
	 * 204 NO CONTENT will return null instead of a fetch error
	 * @return the text if success, throws HttpError otherwise
	 */
	text(): Promise<string | null>;

	/**
	 * 204 NO CONTENT will return null instead of a fetch error
	 * @return the text body whether or not there was success
	 */
	textRaw(): Promise<string | null>;

	/**
	 * 204 NO CONTENT will return null instead of a fetch error
	 * @return the blob if success, throws HttpError otherwise
	 */
	blob(): Promise<Blob | null>;

	/**
	 * 204 NO CONTENT will return null instead of a fetch error
	 * @return the blob body whether or not there was success
	 */
	blobRaw(): Promise<Blob | null>;
}

export class HttpResponseWrapper implements HttpResponse {
	constructor(private promise: Promise<HttpResponse>) {
	}

	async status(): Promise<number> {
		return this.promise.then(r => r.status());
	}

	async success(): Promise<void> {
		return this.promise.then(r => r.success());
	}

	async json(): Promise<any> {
		return this.promise.then(r => r.json());
	}

	async jsonRaw(): Promise<any> {
		return this.promise.then(r => r.jsonRaw());
	}

	async text(): Promise<string | null> {
		return this.promise.then(r => r.text());
	}

	async textRaw(): Promise<string | null> {
		return this.promise.then(r => r.textRaw());
	}

	async blob(): Promise<Blob | null> {
		return this.promise.then(r => r.blob());
	}

	async blobRaw(): Promise<Blob | null> {
		return this.promise.then(r => r.blobRaw());
	}
}

export class HttpError extends Error {
	constructor(message: string, public response: HttpResponse) {
		super(message);
	}
}