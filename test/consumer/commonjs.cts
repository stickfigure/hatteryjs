// Modern Node and TypeScript can load this same ESM package from CommonJS.
import {HTTP, HttpError, type HttpRequest, type HttpTransport, type RawBody} from 'hattery';

const transport: HttpTransport = fetch;
const body: RawBody = Buffer.from([1, 2]);
const request: HttpRequest = HTTP.transport(transport).POST().rawBody(body);
const response: Promise<Response> = request.fetch();
const error = new HttpError(new Response(null, {status: 404}), request);
const errorResponse: Response = error.response;
