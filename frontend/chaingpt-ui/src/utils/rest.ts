import { log } from '@neonevm/solana-sign';

export function prepareHeaders(headersData: Record<string, string>): [Headers, string] {
  const headers: Headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set('Content-Type', 'application/json');
  for (const key in headersData) {
    if (Object.prototype.hasOwnProperty.call(headersData, key)) {
      headers.set(key, headersData[key]);
    }
  }
  const h: string[] = [];
  headers.forEach((value, key) => {
    h.push(`-H '${key}: ${value}'`);
  });
  return [headers, h.join(' ')];
}

export async function post<Rq, Rs = never>(url = '', data: Rq | Rq[], headersData: Record<string, string> = {}, method = 'POST'): Promise<Rs> {
  const [headers, headersString] = prepareHeaders(headersData);
  const body = JSON.stringify(data);
  const fetchData: RequestInit = {
    headers,
    body,
    method: method,
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    redirect: 'follow',
    referrerPolicy: 'no-referrer'
  };
  log(`curl ${url} -X ${method} ${headersString} -d '${body}' | jq .`);
  const response = await fetch(url, fetchData);
  const result = await response.text();
  if (result) {
    return JSON.parse(result);
  }
  return {} as Rs;
}

export async function get<T = never>(url = '', headersData: Record<string, string> = {}): Promise<T> {
  const [headers, headersString] = prepareHeaders(headersData);
  const fetchData: RequestInit = {
    headers,
    method: 'GET',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    redirect: 'follow',
    referrerPolicy: 'no-referrer'
  };
  log(`curl ${url} -X GET ${headersString} | jq .`);
  const response = await fetch(url, fetchData);
  const result = await response.text();
  if (result) {
    return JSON.parse(result);
  }
  return {} as T;
}
