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
		this.response = fetch(request.toUrl(), {
			method: request.getMethod(),
			headers: request.getHeaders(),
		});
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
		return this.response.then(r => r.json());
	}

	/** Doesn't care what the status code is */
	async jsonRaw(): Promise<any> {
		return this.response.then(r => r.json());
	}
}
