import type {HttpRequest} from './HttpRequest.js';

export type Awaitable<T> = T | PromiseLike<T>;
export type ParamScalar = string | number | boolean;
export type ParamValue = ParamScalar | readonly ParamScalar[] | null | undefined;
export type Params<T extends object = Record<string, ParamValue>> = {readonly [K in keyof T]: ParamValue};
export type HeaderValues<T extends object = Record<string, string | null | undefined>> = {readonly [K in keyof T]: string | null | undefined};

/** JSON-compatible input, including ordinary typed interfaces and toJSON() objects. */
export type JsonInput<T> =
	T extends string | number | boolean | null ? T :
	T extends {toJSON(): unknown} ? T :
	T extends (...args: never[]) => unknown ? never :
	T extends readonly unknown[] ? {[K in keyof T]: JsonInput<T[K]>} :
	T extends object ? {[K in keyof T]: JsonInput<T[K]> | (undefined extends T[K] ? undefined : never)} : never;

/** Reusable native bodies. One-shot upload streams are deliberately excluded. */
export type RawBody = string | Blob | FormData | URLSearchParams | ArrayBuffer | ArrayBufferView;
export type FetchOptions = Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'> & {
	readonly method?: never;
	readonly headers?: never;
	readonly body?: never;
	readonly signal?: never;
};

/** A native fetch-compatible function; global fetch can be passed directly. */
export type HttpTransport = (url: string, init: RequestInit) => Promise<Response>;
export type BeforeRequest = (request: HttpRequest) => Awaitable<HttpRequest | void>;
export type AfterResponse = (response: Response, request: HttpRequest) => Awaitable<Response | void>;
export type Next = (request: HttpRequest) => Promise<Response>;
export type Interceptor = (request: HttpRequest, next: Next) => Awaitable<Response>;

/** A parsing function or schema with a parse method. No validator dependency is required. */
export type Decoder<T> = ((value: unknown) => Awaitable<T>) | {parse(value: unknown): Awaitable<T>};
