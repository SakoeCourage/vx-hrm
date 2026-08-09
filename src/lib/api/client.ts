export const GATEWAY_URL = 'https://api.variablexsolutions.com';

type RequestOptions = RequestInit & {
  accessToken?: string;
  tenantId?: string;
};

type ApiErrorBody = {
  detail?: string;
  title?: string;
  message?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  if (options.tenantId) {
    headers.set('x-tenant-id', options.tenantId);
  }

  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorBody = body as ApiErrorBody;
    throw new ApiError(
      errorBody.detail ?? errorBody.message ?? errorBody.title ?? 'Request failed',
      response.status
    );
  }

  return body as T;
}
