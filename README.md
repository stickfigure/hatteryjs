# hatteryjs

Hattery (mad, of course) is a library for making HTTP requests. It provides a simple fluent interface 
based around immutable objects. This javascript version is adapted from the initial 
[Java version](https://github.com/stickfigure/hattery). 

```typescript
// Requests are immutable, start with the base object
import {HTTP} from "hattery";

// A GET request
const thing1 = await HTTP
	.url("http://example.com/1")
	.param("foo", "bar")
	.fetch().json();

// A POST request as application/x-www-form-urlencoded 
const thing2 = await HTTP
	.url("http://example.com/2")
	.POST()
	.param("foo", "bar")
	.fetch().json();

// A POST request with a JSON body
const thing3 = await HTTP
	.url("http://example.com/3")
	.POST()
	.body({"foo":"bar"})
	.fetch().json();

// Some extra stuff you can set
const things4 = await HTTP
	.transport(new MyCustomTransport())
	.url("http://example.com")
	.path("/4")
	.path("andMore")	// adds '/' between path elements automatically
	.header("X-Whatever", "WHATEVER")
	.basicAuth("myname", "mypassword")
	.param("foo", "bar")
	.timeout(1000)
	.retries(3)
	.preflightAndThen(req => req.header("X-Auth-Signature", sign(req)))
	.fetch().json();
```

Install from npm:

```
$ npm install hattery
```

Some extra features:

 * `path()` calls append to the url; `url()` calls replace the whole url.
 * `Content-Type` determines what is to be done with the `body()` and `param()`s (if either are present).
 * Unspecified `Content-Type` is inferred:
   * If there is a `body()`, `application/json` is assumed. Any `param()`s will become query parameters.
   * If `POST()` and no `body()`, parameters will be submitted as `application/x-www-form-urlencoded`
     * ...unless params are submitted as `queryParam()`, which forces them onto the query string.
 
