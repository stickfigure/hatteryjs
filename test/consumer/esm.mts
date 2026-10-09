// Exercise the package's ESM import path with Node-only declarations too.
import {HTTP, HttpError, HttpRequest, type HttpTransport, type RawBody} from 'hattery';

const transport: HttpTransport = fetch;
const body: RawBody = new Uint8Array([1, 2]);
const request: HttpRequest = HTTP.transport(transport).POST().rawBody(body);
const response: Promise<Response> = request.fetch();
const error = new HttpError(new Response(null, {status: 404}), request);
const errorResponse: Response = error.response;
