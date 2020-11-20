import fetch from "isomorphic-fetch";
import {HttpRequest} from "./HttpRequest";
import {HttpResponse, HttpTransport} from "./HttpResponse";

export class FetchTransport implements HttpTransport {
	async fetch(request: HttpRequest): Promise<HttpResponse> {
		const init: RequestInit = {
			method: request.getMethod(),
			headers: request.getHeaders(),
		};

		if (request.getBody() !== null) {
			init.body = JSON.stringify(request.getBody());
		}

		const response = fetch(request.toUrl(), init);

		return new FetchHttpResponse(response);
	}
}

class FetchHttpResponse implements HttpResponse {
	constructor(private response: Promise<Response>) {
	}

	async succeed(): Promise<HttpResponse> {
		const r = await this.response;

		if (r.status >= 400)
			throw new Error("TODO better message. Error code " + r.status);

		return this;
	}

	async status(): Promise<number> {
		return (await this.response).status;
	}

	/** @throws an exception if the status code is 400+ */
	async json(): Promise<any> {
		await this.succeed();
		return this.jsonRaw();
	}

	/** Doesn't care what the status code is */
	async jsonRaw(): Promise<any> {
		return (await this.response).json();
	}

	/** @throws an exception if the status code is 400+ */
	async text(): Promise<string> {
		await this.succeed();
		return this.textRaw();
	}

	/** Doesn't care what the status code is */
	async textRaw(): Promise<any> {
		return (await this.response).text();
	}
}
