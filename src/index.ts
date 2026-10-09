import {HttpRequest} from './HttpRequest';

/** The immutable starting point for request chains. */
export const HTTP = new HttpRequest();
export {HttpRequest};
export {HttpError} from './HttpError';
export type {AfterResponse, Awaitable, BeforeRequest, Decoder, FetchOptions, HeaderValues, HttpTransport, Interceptor, JsonInput, Next, Params, ParamScalar, ParamValue, RawBody} from './types';
