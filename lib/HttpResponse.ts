import {HttpRequest} from "./HttpRequest";

export interface HttpTransport {
	fetch(request: HttpRequest): Promise<HttpResponse>;
}

export interface HttpResponse {
	/** @return the status code, whether or not there was success */
	status(): Promise<number>;

	/** @return the status code if <400, otherwise throws HttpError */
	success(): Promise<number>;

	/** @return the json if success, throws HttpError otherwise */
	json(): Promise<any>;

	/** @return the json body whether or not there was success */
	jsonRaw(): Promise<any>;

	/** @return the text if success, throws HttpError otherwise */
	text(): Promise<string>;

	/** @return the text body whether or not there was success */
	textRaw(): Promise<string>;
}

export class HttpResponseWrapper implements HttpResponse {
	constructor(private promise: Promise<HttpResponse>) {
	}

	async status(): Promise<number> {
		return (await this.promise).status();
	}

	async success(): Promise<number> {
		return (await this.promise).success();
	}

	async json(): Promise<any> {
		return (await this.promise).json();
	}

	async jsonRaw(): Promise<any> {
		return (await this.promise).jsonRaw();
	}

	async text(): Promise<string> {
		return (await this.promise).text();
	}

	async textRaw(): Promise<string> {
		return (await this.promise).textRaw();
	}
}

export class HttpError extends Error {
	constructor(message: string, public response: HttpResponse) {
		super(message);
	}
}