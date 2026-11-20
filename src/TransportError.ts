import type {HttpRequest} from './HttpRequest.js';

/** A transport or response-body failure, not a diagnosis of connectivity or retry safety. */
export class TransportError extends Error {
	declare readonly cause: unknown;
	readonly method: string;
	readonly url: string;
	/** request means no response was returned; the server may still have processed the request. */
	readonly phase: 'request' | 'body';

	/** Supply a response for a body-read failure; omit it for a transport failure. */
	constructor(cause: unknown, readonly request: HttpRequest, readonly response?: Response) {
		const phase = response === undefined ? 'request' : 'body';
		super(`${request.getMethod()} ${request.toUrl()} failed while ${phase === 'request' ? 'fetching response headers' : 'reading the response body'}`, {cause});
		this.name = 'TransportError';
		this.method = request.getMethod();
		this.url = request.toUrl();
		this.phase = phase;
	}
}
