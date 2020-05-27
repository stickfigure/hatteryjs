import {expect} from 'chai';
import 'mocha';
import {SNOOP} from "./fixtures";

describe('Preflight functions', () => {
	it('can modify the request', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.preflight(req => req.param('foo', 'other'))
				.fetch().json();

		expect(result.queryParams['foo']).to.equal("other");
	});

	it('can replace the preflight', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.preflight(req => req.param('foo', 'other'))
				.preflight(req => req.param('asdf', '123'))
				.fetch().json();

		expect(result.queryParams['foo']).to.equal('bar');
		expect(result.queryParams['asdf']).to.equal('123');
	});

	it('can chain the preflight', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.preflight(req => req.param('foo', 'other'))
				.preflightAndThen(req => req.param('asdf', '123'))
				.fetch().json();

		expect(result.queryParams['foo']).to.equal('other');
		expect(result.queryParams['asdf']).to.equal('123');
	});
});
