import {expect} from 'chai';
import 'mocha';
import {HttpError} from "../lib/HttpResponse";
import {SNOOP} from "./fixtures";

describe('Error testing', () => {
	it('throws a HttpError', async () => {
		try {
			await SNOOP
					.param('status', '400')
					.fetch().success();
		} catch (e: any) {
			expect(e).to.be.instanceOf(HttpError);
			expect(e.response).to.not.be.null;
			const json = await e.response.jsonRaw()
			expect(json.query).to.equal("status=400");
		}
	});
});
