import type {RawBody} from './types.js';

// All byte views, including views over shared memory, are copied to ordinary buffers.
type CopiedBody = Exclude<RawBody, ArrayBufferView>;

export interface Body {
	readonly contentType?: string | undefined;
	create(): CopiedBody;
}

export function jsonBody(value: unknown): Body {
	const text = JSON.stringify(value);
	if (text === undefined) throw new TypeError('The body must be JSON-serializable; use rawBody(null) to clear it.');
	return {contentType: 'application/json', create: () => text};
}

/** Copy on input and execution so custom transports cannot mutate the template. */
export function rawBody(value: RawBody, contentType?: string): Body {
	const snapshot = copy(value);
	return {contentType, create: () => copy(snapshot)};
}

function copy(value: RawBody): CopiedBody {
	if (typeof value === 'string' || value instanceof Blob) return value;
	if (value instanceof URLSearchParams) return new URLSearchParams(value);
	if (value instanceof FormData) {
		const result = new FormData();
		for (const [key, entry] of value) result.append(key, entry);
		return result;
	}
	if (value instanceof ArrayBuffer) return value.slice(0);
	if (ArrayBuffer.isView(value)) return new Uint8Array(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)).buffer;
	throw new TypeError('rawBody() requires a string, Blob, FormData, URLSearchParams, ArrayBuffer, or typed array.');
}
