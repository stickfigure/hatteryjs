import {expect} from 'chai';
import 'mocha';
import {HTTP} from "../lib";
import {SNOOP} from "./fixtures";

describe('Headers testing', () => {
	it('submits headers', async () => {
		const result = await SNOOP
				.header("Foo", "Bar")
				.header("Foo2", "Bar2")
				.fetch().json();

		expect(result.headers).to.deep.include({"Foo":"Bar", "Foo2":"Bar2"});
	});

	it('replaces headers', async () => {
		const result = await SNOOP
				.header("Foo", "Bar")
				.header("Foo", "Bar2")
				.fetch().json();

		expect(result.headers).to.deep.include({"Foo":"Bar2"});
	});

	it('can specify Content-Type', async () => {
		const result = await SNOOP
				.contentType("not/real")
				.fetch().json();

		expect(result.headers).to.deep.include({"Content-Type":"not/real"});
	});

	it('can specify basic auth', async () => {
		const result = await SNOOP
				.basicAuth("test", "testing")
				.fetch().json();

		expect(result.headers).to.deep.include({"Authorization": "Basic dGVzdDp0ZXN0aW5n"});
	});
});
