// client/src/lib/api.js
// Standard API client and error handling for SkillSwap

export class ApiError extends Error {
  constructor(message, status = 500, details = null, retryAfter = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

/**
 * Perform an HTTP request with automatic JSON serialization, credentials,
 * and unified error parsing.
 *
 * @param {string} endpoint - Relative path (e.g. '/api/matches')
 * @param {RequestInit} [options={}] - Standard fetch options
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Auto-set Content-Type for JSON payloads if not already specified and not FormData
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  let response;
  try {
    response = await fetch(endpoint, {
      credentials: 'same-origin',
      ...options,
      headers,
    });
  } catch (err) {
    throw new ApiError(
      'Cannot reach the server. Please check your connection and try again.',
      0,
      err
    );
  }

  // Handle successful empty response (e.g. 204 No Content)
  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        data = { message: text };
      }
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let retryAfter = null;
    const retryHeader = response.headers.get('retry-after');
    if (retryHeader) {
      const parsed = parseInt(retryHeader, 10);
      if (!Number.isNaN(parsed)) {
        retryAfter = parsed;
      }
    }

    const message =
      data?.error ||
      data?.message ||
      response.statusText ||
      `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, data?.details || null, retryAfter);
  }

  return data;
}

