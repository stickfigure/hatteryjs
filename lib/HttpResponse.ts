import {HttpRequest} from "./HttpRequest";

export interface HttpTransport {
	fetch(request: HttpRequest): Promise<HttpResponse>;
}

export interface HttpResponse {
	/** @return the status code, whether or not there was success */
	status(): Promise<number>;

	/** Throws HttpError if code is >= 400 */
	success(): Promise<void>;

	/** @return the json if success, throws HttpError otherwise */
	json(): Promise<any>;

	/** @return the json body whether or not there was success */
	jsonRaw(): Promise<any>;

	/** @return the text if success, throws HttpError otherwise */
	text(): Promise<string>;

	/** @return the text body whether or not there was success */
	textRaw(): Promise<string>;

	/** @return the blob if success, throws HttpError otherwise */
	blob(): Promise<Blob>;

	/** @return the blob body whether or not there was success */
	blobRaw(): Promise<Blob>;
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

	async text(): Promise<string> {
		return this.promise.then(r => r.text());
	}

	async textRaw(): Promise<string> {
		return this.promise.then(r => r.textRaw());
	}

	async blob(): Promise<Blob> {
		return this.promise.then(r => r.blob());
	}

	async blobRaw(): Promise<Blob> {
		return this.promise.then(r => r.blobRaw());
	}
}

export class HttpError extends Error {
	constructor(message: string, public response: HttpResponse) {
		super(message);
	}
}