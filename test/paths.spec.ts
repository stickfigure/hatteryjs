import {expect} from 'chai';
import 'mocha';
import {HTTP} from "../lib";
import {SNOOP} from "./fixtures";

describe('Path testing', () => {
	it('handles paths in the full url (replacement)', async () => {
		const result = await SNOOP
				.url('https://hattery-snoop.appspot.com/foo')	// replace the url
				.fetch().json();

		expect(result.path).to.equal("/foo");
	});

	it('concatenates paths', async () => {
		const result = await SNOOP
				.path("/one")
				.path("/two")
				.fetch().json();

		expect(result.path).to.equal("/one/two");
	});

	it('is ambivalent about slashes in path elements', async () => {
		const result = await SNOOP
				.path("/one")
				.path("two")
				.path("three/")
				.path("/four/")
				.path("five")
				.fetch().json();

		expect(result.path).to.equal("/one/two/three/four/five");
	});
});
