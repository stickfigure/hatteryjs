import {expect} from 'chai';
import 'mocha';
import {SNOOP} from "./fixtures";

describe('Body behavior', () => {
	it('sends a json body', async () => {
		const result = await SNOOP
				.POST()
				.body({foo: 'bar'})
				.fetch().json();

		expect(result.body).to.equal("{\"foo\":\"bar\"}");
	});
});
