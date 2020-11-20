import {HttpRequest} from "./HttpRequest";

export interface HttpTransport {
	fetch(request: HttpRequest): Promise<HttpResponse>;
}

export interface HttpResponse {
	status(): Promise<number>;
	succeed(): Promise<HttpResponse>;
	json(): Promise<any>;
	jsonRaw(): Promise<any>;
	text(): Promise<string>;
	textRaw(): Promise<string>;
}

export class HttpResponseWrapper implements HttpResponse {
	constructor(private promise: Promise<HttpResponse>) {
	}

	async status(): Promise<number> {
		return (await this.promise).status();
	}

	async succeed(): Promise<HttpResponse> {
		return (await this.promise).succeed();
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