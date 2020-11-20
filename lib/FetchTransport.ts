import fetch from "isomorphic-fetch";
import {HttpRequest} from "./HttpRequest";
import {HttpResponse, HttpTransport} from "./HttpResponse";

export class FetchTransport implements HttpTransport {
	fetch(request: HttpRequest): HttpResponse {
		return new FetchHttpResponse(request);
	}
}

class FetchHttpResponse implements HttpResponse {
	response: Promise<Response>;

	constructor(request: HttpRequest) {
		const init: RequestInit = {
			method: request.getMethod(),
			headers: request.getHeaders(),
		};

		if (request.getBody() !== null) {
			init.body = JSON.stringify(request.getBody());
		}

		this.response = fetch(request.toUrl(), init);
	}

	async succeed(): Promise<HttpResponse> {
		const r = await this.response;

		if (r.status >= 400)
			throw new Error("TODO better message. Error code " + r.status);

		return this;
	}

	async status(): Promise<number> {
		return this.response.then(r => r.status);
	}

	/** @throws an exception if the status code is 400+ */
	async json(): Promise<any> {
		await this.succeed();
		return this.jsonRaw();
	}

	/** Doesn't care what the status code is */
	async jsonRaw(): Promise<any> {
		return this.response.then(r => r.json());
	}

	/** @throws an exception if the status code is 400+ */
	async text(): Promise<string> {
		await this.succeed();
		return this.textRaw();
	}

	/** Doesn't care what the status code is */
	async textRaw(): Promise<any> {
		return this.response.then(r => r.text());
	}
}
