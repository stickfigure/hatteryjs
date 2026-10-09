import type {HttpRequest} from './HttpRequest';

/** HTTP failure from a checked shortcut. The response body remains available to read. */
export class HttpError extends Error {
	readonly status: number;
	readonly method: string;
	readonly url: string;

	constructor(readonly response: Response, readonly request: HttpRequest) {
		super(`${request.getMethod()} ${request.toUrl()} failed: ${response.status} ${response.statusText}`.trim());
		this.name = 'HttpError';
		this.status = response.status;
		this.method = request.getMethod();
		this.url = request.toUrl();
	}
}
