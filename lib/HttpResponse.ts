import {HttpRequest} from "./HttpRequest";

export interface HttpTransport {
	fetch(request: HttpRequest): HttpResponse;
}

export interface HttpResponse {
	succeed(): Promise<HttpResponse>;
	json(): Promise<any>;
}