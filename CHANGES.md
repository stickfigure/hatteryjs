# Changes

## 0.2.0
2026-11-20

Hattery now consolidates network failures into `TransportError`. Import it from `hattery` and catch it around a terminal call such as `await request.json()`. Its `phase` tells you where the failure occurred:

- `'request'` means the transport failed before returning a response.
- `'body'` means a shortcut received a response but failed while reading its body. The error includes that `response`.

Both phases preserve the original `cause` and include the request, method, and URL. HTTP status failures still produce `HttpError`, malformed JSON throws `SyntaxError`, and cancellation preserves the abort reason. When you use raw `fetch()`, subsequent reads on the returned `Response` use native error handling.
