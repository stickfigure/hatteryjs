import {expect} from 'chai';
import 'mocha';
import {HttpResponse, HttpResponseWrapper} from "../lib/HttpResponse";
import {SNOOP} from "./fixtures";

describe('Intercept functions', () => {
	it('can fires in the right order with preflight and postflight', async () => {
		const ordering: number[] = [];
		await SNOOP
				.param('foo', 'bar')
				.preflightAndThen(req => {
					ordering.push(1);
					return req;
				})
				.preflightAndThen(req => {
					ordering.push(2);
					return req;
				})
				.intercept(async (req, proceed) => {
					ordering.push(4);
					try {
						return await proceed(req);
					} finally {
						ordering.push(5);
					}
				})
				.intercept(async (req, proceed) => {
					ordering.push(3);
					try {
						return await proceed(req);
					} finally {
						ordering.push(6);
					}
				})
				.postflightAndThen(async resp => {
					try {
						return await resp;
					} finally {
						ordering.push(7);
					}
				})
				.postflightAndThen(async resp => {
					try {
						return await resp;
					} finally {
						ordering.push(8);
					}
				})
				.fetch().succeed();

		expect(ordering).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
	});
});
