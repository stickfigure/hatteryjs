import fetch from "isomorphic-fetch";
import {HttpRequest} from "./HttpRequest";
import {HttpError, HttpResponse, HttpTransport} from "./HttpResponse";

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

	private async succeed(): Promise<HttpResponse> {
		const r = await this.response;

		if (r.status >= 400)
			throw new HttpError(`Error ${r.status}: ${r.statusText}`, this);

		return this;
	}

	status(): Promise<number> {
		return this.response.then(r => r.status);
	}

	success(): Promise<number> {
		return this.succeed().then(r => r.status());
	}

	json(): Promise<any> {
		return this.succeed().then(r => r.jsonRaw());
	}

	jsonRaw(): Promise<any> {
		return this.response.then(r => r.json());
	}

	text(): Promise<string> {
		return this.succeed().then(r => r.textRaw());
	}

	textRaw(): Promise<any> {
		return this.response.then(r => r.text());
	}
}
