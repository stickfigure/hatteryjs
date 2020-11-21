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

	describe('#params()', async () => {
		it('replaces parameters', async () => {
			const result = await SNOOP
					.param('foo', 'bar')
					.params({foo: 'rab', foz: 'baz'})
					.fetch().json();

			expect(result.query).to.equal("foo=rab&foz=baz");
		});
	})

	it('accepts repeating parameters as array', async () => {
		const result = await SNOOP
				.param('foo', ['bar', 'baz'])
				.fetch().json();

		expect(result.query).to.equal("foo=bar&foo=baz");
	});

	it('removes params if value is null', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.param('foo', null)
				.fetch().json();

		expect(result.query).to.equal("");
	});
});
