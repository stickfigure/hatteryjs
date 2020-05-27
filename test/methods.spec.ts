import {expect} from 'chai';
import 'mocha';
import {SNOOP} from "./fixtures";

describe('Method testing', () => {
	it('is GET by default', async () => {
		const result = await SNOOP
				.fetch().json();

		expect(result.method).to.equal('GET');
	});

	it('uses POST', async () => {
		const result = await SNOOP
				.POST()
				.fetch().json();

		expect(result.method).to.equal('POST');
	});

	it('uses PUT', async () => {
		const result = await SNOOP
				.PUT()
				.fetch().json();

		expect(result.method).to.equal('PUT');
	});

	it('uses DELETE', async () => {
		const result = await SNOOP
				.DELETE()
				.fetch().json();

		expect(result.method).to.equal('DELETE');
	});

	it('uses HEAD', async () => {
		const result = await SNOOP
				.HEAD()
				.fetch().text();

		expect(result).to.equal('');
	});
});
