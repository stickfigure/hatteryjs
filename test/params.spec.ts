import {expect} from 'chai';
import 'mocha';
import {SNOOP} from "./fixtures";

describe('Parameter testing', () => {
	it('adds parameters', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.fetch().json();

		expect(result.query).to.equal("foo=bar");
	});

	it('replaces parameters', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.param('foo', 'rab')
				.fetch().json();

		expect(result.query).to.equal("foo=rab");
	});

	it('accepts repeating parameters as array', async () => {
		const result = await SNOOP
				.param('foo', ['bar', 'baz'])
				.fetch().json();

		expect(result.query).to.equal("foo=bar&foo=baz");
	});
});
