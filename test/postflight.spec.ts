import {expect} from 'chai';
import 'mocha';
import {HttpResponse, HttpResponseWrapper} from "../lib/HttpResponse";
import {SNOOP} from "./fixtures";

class ResponseMunger extends HttpResponseWrapper {
	constructor(resp: Promise<HttpResponse>, private key: string, private value: string) {
		super(resp);
	}

	async json(): Promise<any> {
		const json = await super.json();
		json.queryParams[this.key] = this.value;
		return json;
	}
}

describe('Postflight functions', () => {
	it('can modify the response', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.postflight(async resp => {
					return new ResponseMunger(resp, 'foo', 'other');
				})
				.fetch().json();

		expect(result.queryParams['foo']).to.equal("other");
	});

	it('can replace the postflight', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.postflight(async resp => {
					return new ResponseMunger(resp, 'foo', 'other');
				})
				.postflight(async resp => {
					return new ResponseMunger(resp, 'asdf', '123');
				})
				.fetch().json();

		expect(result.queryParams['foo']).to.equal('bar');
		expect(result.queryParams['asdf']).to.equal('123');
	});

	it('can chain the postflight', async () => {
		const result = await SNOOP
				.param('foo', 'bar')
				.postflight(async resp => {
					return new ResponseMunger(resp, 'foo', 'other');
				})
				.postflightAndThen(async resp => {
					return new ResponseMunger(resp, 'asdf', '123');
				})
				.fetch().json();

		expect(result.queryParams['foo']).to.equal('other');
		expect(result.queryParams['asdf']).to.equal('123');
	});
});
