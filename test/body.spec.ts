import {expect} from 'chai';
import 'mocha';
import {SNOOP} from "./fixtures";

describe('Body behavior', () => {
	it('sends a json body', async () => {
		const result = await SNOOP
				.POST()
				.body({foo: 'bar'})
				.fetch().json();

		expect(result.body).to.deep.equal({"foo":"bar"});
		expect(result.headers["Content-Type"]).to.equal("application/json");
	});
});
