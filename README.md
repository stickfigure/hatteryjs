# hattery

Immutable, fluent HTTP requests for TypeScript. Build a base request once, derive requests from it, and get typed results with one `await`. Inspired by [Hattery for Java](https://github.com/stickfigure/hattery).

```sh
npm install hattery
```

Requires Node.js 22+ or a modern browser with native fetch and `AbortSignal.any` (use a bundler for browsers). No runtime dependencies. TypeScript 5.4+ is required for the declarations; use `@types/node` 22+ for Node projects or DOM types for browser projects.

## Everyday requests

```ts
import {HTTP} from 'hattery';

interface User {
  id: number;
  name: string;
}

const api = HTTP
  .url('https://example.com/api')
  .bearerAuth(token)
  .timeout(5_000);

const users = await api.path('users')
  .params({active: true, limit: 25})
  .json<User[]>();

const created = await api.path('users')
  .POST({name: 'Ada'})
  .json<User>();

await api.path('users').segment(created.id)
  .PATCH({name: 'Ada Lovelace'})
  .success();

await api.path('users').segment(created.id).DELETE().success();
```

GET is the default. `GET()`, `HEAD()`, `POST()`, `PUT()`, `PATCH()`, `DELETE()`, and `OPTIONS()` select a method; `method('PROPFIND')` supports other methods. `POST(data)`, `PUT(data)`, and `PATCH(data)` also set a JSON body. Building a request never sends it, and every terminal call executes a new request.

The base `api` is unchanged by every example. Request data is copied: changing a parameter array, JSON object, `FormData`, or byte buffer after passing it to Hattery does not change the request. Native inspection methods return independent copies. Hooks, transports, and caller-provided abort signals retain their external behavior.

## Types and runtime validation

`json()` returns `Promise<unknown>`. `json<User>()` tells TypeScript what you expect, but does **not** validate the server's response. For validation, pass a decoder; its return type is inferred:

```ts
function parseUser(value: unknown): User {
  if (typeof value !== 'object' || value === null ||
      !('id' in value) || typeof value.id !== 'number' ||
      !('name' in value) || typeof value.name !== 'string') {
    throw new Error('Invalid user');
  }
  return {id: value.id, name: value.name};
}

const user = await api.path('me').json(parseUser); // User
```

Async decoders work too. Schema objects with a `parse(value: unknown)` method can be passed directly, for example `json(UserSchema)`. Hattery does not depend on a particular validator. Decoder failures propagate unchanged.

JSON body methods accept ordinary typed interfaces, readonly arrays, optional properties, and objects with `toJSON()` such as dates. They reject unsupported types such as bigint, functions, and `FormData` at compile time. JSON serialization happens when the body is set, so circular objects throw immediately. Optional `undefined` object fields are omitted following `JSON.stringify` semantics.

## URLs, parameters, and headers

```ts
const request = api
  .path('teams', 'members')       // literal path fragments
  .segment('an/id with spaces')   // one encoded identifier
  .params({page: 2, enabled: false, tag: ['red', 'blue']})
  .headers({'Accept': 'application/json', 'X-Client': 'my-app'});

console.log(request.toUrl());
```

- `url(stringOrURL)` replaces the URL. Separately configured parameters are preserved.
- `path(...parts)` appends path fragments, joining slashes and preserving the URL's query and fragment. Use `params()` for query data.
- `segment(...values)` encodes each string or numeric identifier separately: `.path('files').segment('a/b')` appends `/files/a%2Fb`, keeping the slash inside one identifier. Empty and dot-only identifiers are rejected because URLs normalize dot segments.
- `param(name, value)` and `params(objectOrURLSearchParams)` always set **query** parameters, including on POST requests. Repeated keys use arrays. Strings, numbers, and booleans are accepted.
- Parameter updates replace matching keys, including keys in the original URL. `undefined` preserves an inherited value; `null` or `[]` removes it. Other keys stay intact.
- `header(name, value)` and `headers(objectOrHeaders)` merge case-insensitively. `undefined` preserves a value; `null` removes an explicit header.
- `bearerAuth(token)` and `basicAuth(username, password)` set Authorization. Basic credentials use UTF-8.
- `contentType(value)` sets an explicit content type; `contentType(null)` returns to body-based inference.

Relative URLs work in browsers. Node's fetch requires absolute URLs. `toUrl()` preserves original query encoding until parameters are edited; parameter edits use `URLSearchParams` encoding, which matters for signed URLs.

## Request bodies

```ts
// JSON, including literal JSON null
await api.path('users').POST({name: 'Ada'}).json<User>();
await api.path('settings').PUT(null).success();

// URL-encoded form; query parameters stay separate
await api.path('login').POST()
  .param('source', 'web')
  .form({username, password})
  .success();

// Raw text
await api.path('notes').PUT()
  .rawBody('Hello', 'text/plain')
  .success();

// Multipart upload: fetch sets the boundary and Content-Type
const upload = new FormData();
upload.append('file', file);
await api.path('files').POST().rawBody(upload).success();
```

`body(value)` sets JSON without changing the method. `form(values)` sets an explicit URL-encoded body. `rawBody(value, contentType?)` accepts a string, Blob/File, FormData, URLSearchParams, ArrayBuffer, or typed array. It sends the bytes without JSON encoding. One-shot upload streams are excluded so request bodies can be safely reused. `rawBody(null)` clears the body; `body(null)` sends JSON `null`.

Changing the body replaces the old body and its inferred content type. An explicitly configured Content-Type still takes precedence. Do not set a multipart Content-Type yourself: fetch generates it with the matching boundary. GET and HEAD requests with a body reject before transport execution.

## Responses and errors

| Terminal | Result | HTTP status checking |
| --- | --- | --- |
| `json<T>()` / `json(decoder)` | Parsed or validated JSON | Requires 2xx |
| `jsonOrNull<T>()` / `jsonOrNull(decoder)` | JSON, or `null` for 204, 205, or HEAD | Requires 2xx |
| `text()` | `string`, including `''` for an empty body | Requires 2xx |
| `blob()` | `Blob` | Requires 2xx |
| `arrayBuffer()` | `ArrayBuffer` | Requires 2xx |
| `success()` | `void`; requests cleanup of the unused body | Requires 2xx |
| `fetch()` | Native `Response` | Caller decides |

`json()` expects JSON: an empty or malformed body throws. `jsonOrNull()` handles HTTP responses that explicitly have no body; it still throws for malformed JSON or an unexpectedly empty 200 response. A literal JSON `null` is parsed normally; use a decoder if your endpoint must return a non-null value.

`success()` cancels the unused response body without waiting for cleanup, which can depend on another reader of a cloned response. Cleanup failures are ignored; HTTP and network failures still reject normally.

```ts
import {HttpError} from 'hattery';

try {
  await api.path('users').POST({name: 'Ada'}).json<User>();
} catch (error) {
  if (error instanceof HttpError) {
    console.log(error.status, error.method, error.url);
    const details: unknown = await error.response.json();
  } else {
    throw error;
  }
}
```

`HttpError` contains the native `response` and effective `request`, and leaves the error body unread. Network, cancellation, JSON parsing, and validation errors propagate unchanged. Checked shortcuts also reject unfollowed redirects; use `fetch()` when you want to inspect them.

```ts
const response = await api.path('users').fetch();
console.log(response.status, response.headers.get('x-request-id'));
const body: unknown = await response.json();
```

Native bodies are consumed once. Use `response.clone()` to inspect a body while leaving it available for another reader, or `response.body` for streaming. There is no custom response wrapper and no `jsonRaw()` method.

## Hooks and middleware

Hooks compose in registration order and may be asynchronous. Returning nothing from a hook keeps its input unchanged.

```ts
const authenticated = api
  .beforeRequest(async request =>
    request.bearerAuth(await getAccessToken()))
  .afterResponse((response, request) => {
    console.log(request.toUrl(), response.status);
  });
```

Before hooks run for each execution. They can replace the request, including its transport, signal, or timeout. The before-hook list is captured at the start; hooks added during that phase do not recursively run in the same execution. Response hooks receive the resolved native response and can return a replacement response. Read a **clone** in a response hook if downstream code also needs the body.

`intercept((request, next) => ...)` wraps the transport for caching, timing, or application-specific retry behavior:

```ts
const timed = api.intercept(async (request, next) => {
  const started = performance.now();
  try {
    return await next(request);
  } finally {
    console.log(`Response headers took ${performance.now() - started}ms`);
  }
});
```

Execution order is before hooks → interceptors → transport → interceptor unwinding → response hooks → checked shortcut/decoder. The first registered interceptor is outermost. `next(request)` waits for actual response headers and propagates network failures; HTTP error statuses remain inspectable responses at this layer. Shortcuts check status after response hooks. Calling `next()` again performs another attempt without rerunning before hooks. Hattery does not automatically retry requests.

## Cancellation, timeouts, and fetch options

```ts
const controller = new AbortController();
const pending = api.path('users')
  .signal(controller.signal)
  .timeout(5_000)
  .json<User[]>();

controller.abort(); // pending rejects with the signal's reason
```

A timeout starts after before hooks and is fresh for each execution. It covers transport and response hooks, plus body reading and decoding for shortcuts. For `fetch()`, it ends when the response is returned; use a caller signal to control later streaming reads. External cancellation also interrupts before hooks. Timeout failures have name `TimeoutError`. `timeout(0)` disables an inherited timeout; `signal(undefined)` clears an inherited caller signal. Cancellation stops waiting for custom hooks/transports; their own asynchronous work must honor the signal to stop its side effects.

Use `fetchOptions({credentials: 'include', redirect: 'manual', cache: 'no-store'})` for native fetch settings. Configure method, body, headers, and signal through the dedicated fluent methods. Options merge with inherited defaults.

For tests or another fetch implementation, supply a function:

```ts
const fake = api.transport(async (url, init) =>
  Response.json({id: 1, name: 'Ada'}));

const user = await fake.path('users').segment(1).json<User>();
```

The function receives the final URL and fresh RequestInit and returns `Promise<Response>`. Native `fetch` is directly compatible. `getUrl()`, `getMethod()`, `getHeaders()`, `toUrl()`, `toSearchParams()`, and `toRequestInit()` support inspection without executing the request. `toRequestInit()` does not run hooks or start a timeout.

## Migrating from 0.0.x

This redesign intentionally changes the API:

| Previous | New |
| --- | --- |
| `.POST().body(data)` | `.POST(data)` |
| `.fetch().json()` | `.json<T>()` or `.json(decoder)` |
| `.fetch().text()` / `.fetch().success()` | `.text()` / `.success()` |
| `await response.status()` | `response.status` after `await request.fetch()` |
| `.POST().params(fields)` to send a form | `.POST().form(fields)` |
| `.preflightAndThen(fn)` | `.beforeRequest(fn)` |
| `.postflightAndThen(fn)` | `.afterResponse(fn)` with a native Response |
| `.preflight(fn)` / `.postflight(fn)` replacing hooks | Hooks now append; derive from a base without the unwanted hook |
| Latest interceptor runs outermost | First registered interceptor runs outermost |
| `HttpTransport` class / `HttpResponseWrapper` | Fetch-compatible function / native Response |
| `.jsonRaw()` | `(await request.fetch()).json()` |
| JSON result implicitly `any` | `unknown`, an explicit generic, or an inferred decoder result |
| JSON 204 implicitly returns `null` | `.jsonOrNull<T>()` or `.success()` |
| `param(key, undefined)` removes a value | `param(key, null)` removes; `undefined` preserves |

## Development

```sh
npm install
npm test
npm run typecheck
```

Tests compile the library, public API type assertions, and package imports in Node-only and browser TypeScript projects, then use Node's test runner with isolated transports and a local HTTP server. They require no external services. `npm run build` produces the CommonJS package and declaration files under `dist/lib`.

`npm pack` builds the package before creating its tarball. `npm publish` runs the tests and builds the package before publishing; a failed check stops the release. `./publish.sh` delegates to the same npm lifecycle and forwards any arguments.
