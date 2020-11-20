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

	async status(): Promise<number> {
		return (await this.response).status;
	}

	async success(): Promise<number> {
		return (await this.succeed()).status();
	}

	async json(): Promise<any> {
		return (await this.succeed()).jsonRaw();
	}

	async jsonRaw(): Promise<any> {
		return (await this.response).json();
	}

	async text(): Promise<string> {
		return (await this.succeed()).textRaw();
	}

	async textRaw(): Promise<any> {
		return (await this.response).text();
	}
}
