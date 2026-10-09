import type {Awaitable} from './types';

/** Observe cancellation even when a custom transport or hook does not honor its signal. */
export function abortable<T>(work: () => Awaitable<T>, signal?: AbortSignal): Promise<T> {
	if (signal?.aborted) return Promise.reject(signal.reason);
	if (!signal) return Promise.resolve().then(work);
	return new Promise<T>((resolve, reject) => {
		const abort = () => reject(signal.reason);
		signal.addEventListener('abort', abort, {once: true});
		Promise.resolve().then(() => {
			signal.throwIfAborted();
			return work();
		}).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}

export function executionScope(signal: AbortSignal | undefined, timeout: number) {
	if (!timeout) return {signal, dispose() {}};
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(new DOMException(`Request timed out after ${timeout}ms`, 'TimeoutError')), timeout);
	return {
		// Preserve caller cancellation of a raw Response's body after fetch returns.
		signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
		dispose() { clearTimeout(timer); },
	};
}
