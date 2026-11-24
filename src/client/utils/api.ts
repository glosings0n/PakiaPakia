import type { ApiError } from '../../shared/api';

export class ApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const isApiError = (value: unknown): value is ApiError =>
  typeof value === 'object' &&
  value !== null &&
  'message' in value &&
  typeof value.message === 'string';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, init);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiFailure(
      isApiError(body) ? body.message : `Request failed (${res.status})`,
      res.status
    );
  }
  // The server and client share the response types in src/shared/api.ts.
  return body as T;
};

export const getJson = <T>(path: string): Promise<T> => request<T>(path);

export const postJson = <T>(path: string, payload: unknown = {}): Promise<T> =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
