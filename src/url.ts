import type {ParamValue} from './types.js';

export function splitUrl(url: string) {
	const hashIndex = url.indexOf('#');
	const hash = hashIndex < 0 ? '' : url.slice(hashIndex);
	const beforeHash = hashIndex < 0 ? url : url.slice(0, hashIndex);
	const queryIndex = beforeHash.indexOf('?');
	return {
		path: queryIndex < 0 ? beforeHash : beforeHash.slice(0, queryIndex),
		query: queryIndex < 0 ? '' : beforeHash.slice(queryIndex + 1),
		hash,
	};
}

export function appendPath(url: string, parts: readonly string[]): string {
	const {path, query, hash} = splitUrl(url);
	let result = path;
	for (const part of parts) {
		if (/[?#]/.test(part)) throw new TypeError('Use params() for query parameters; path() accepts only path fragments.');
		if (!part) continue;
		result = result ? result.replace(/\/+$/, '') + '/' + part.replace(/^\/+/, '') : part;
	}
	return result + (query ? '?' + query : '') + hash;
}

export function paramEntries(values: object): [string, ParamValue][] {
	if (!(values instanceof URLSearchParams)) return Object.entries(values);
	const entries = new Map<string, string[]>();
	for (const [key, value] of values) {
		const list = entries.get(key) ?? [];
		list.push(value);
		entries.set(key, list);
	}
	return [...entries];
}

export function paramStrings(value: Exclude<ParamValue, null | undefined>): readonly string[] {
	return Object.freeze((Array.isArray(value) ? value : [value]).map(String));
}
