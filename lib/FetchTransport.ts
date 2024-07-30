import {HttpRequest} from "./HttpRequest";
import {HttpError, HttpResponse, HttpTransport} from "./HttpResponse";

export class FetchTransport implements HttpTransport {
	async fetch(request: HttpRequest): Promise<HttpResponse> {
		const init: RequestInit = {
			method: request.getMethod(),
			headers: request.getEffectiveHeaders(),
		};

		if (request.getBody() != null) {
			init.body = JSON.stringify(request.getBody());
		} else if (request.isForm()) {
			init.body = request.toSearchParams();
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

	success(): Promise<void> {
		return this.succeed().then(() => {});
	}

	json(): Promise<any> {
		return this.succeed().then(r => r.jsonRaw());
	}

	jsonRaw(): Promise<any> {
		return this.response.then(r => r.status == 204 ? null : r.json());
	}

	text(): Promise<string | null> {
		return this.succeed().then(r => r.textRaw());
	}

	textRaw(): Promise<string | null> {
		return this.response.then(r => r.status == 204 ? null : r.text());
	}

	blob(): Promise<Blob | null> {
		return this.succeed().then(r => r.blobRaw());
	}

	blobRaw(): Promise<Blob | null> {
		return this.response.then(r => r.status == 204 ? null : r.blob());
	}
}