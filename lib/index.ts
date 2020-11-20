import {FetchTransport} from "./FetchTransport";
import {HttpRequest} from "./HttpRequest";

export const HTTP = new HttpRequest(
		new FetchTransport(),
		'GET',
		'',
		{},
		{},
		req => req,
		resp => resp,
		(req, proceed) => proceed(req),
		null);

export {HttpRequest};
export {HttpResponse, HttpError, HttpTransport} from "./HttpResponse";