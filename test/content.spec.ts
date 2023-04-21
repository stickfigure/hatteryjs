import {expect} from 'chai';
import 'mocha';
import {SNOOP} from "./fixtures";

describe('Special content situations', () => {
	it('returns null for 204 NO CONTENT', async () => {
		const result = await SNOOP
				.path("/204")
				.fetch().json();

		expect(result).to.be.null;
	});
});
