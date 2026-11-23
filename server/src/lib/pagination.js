/**
 * Parses and clamps limit.
 * If clientLimit is undefined, returns the safe default cap.
 * If clientLimit is provided, clamps it between 1 and maxLimit (default 100).
 */
export function clampLimit(
  clientLimit,
  defaultCap,
  maxLimit = 100
) {
  if (clientLimit === undefined || clientLimit === null || Number.isNaN(clientLimit)) {
    return defaultCap;
  }
  return Math.max(1, Math.min(clientLimit, maxLimit));
}

/**
 * Builds offset-based page pagination metadata.
 */
export function buildPagePaginationMeta(
  total,
  page,
  limit
) {
  const safeTotal = Math.max(0, total);
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const hasNextPage = safePage < totalPages;
  const hasPrevPage = safePage > 1 && safePage <= totalPages + 1;

  return {
    total: safeTotal,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
}

/**
 * Builds cursor-based pagination metadata.
 */
export function buildCursorPaginationMeta(
  total,
  limit,
  nextCursor
) {
  const safeTotal = Math.max(0, total);
  const safeLimit = Math.max(1, limit);
  const hasMore = nextCursor !== null && nextCursor !== undefined && nextCursor !== "";

  return {
    total: safeTotal,
    limit: safeLimit,
    hasMore,
    nextCursor: hasMore ? nextCursor : null,
  };
}

/**
 * Returns HTTP response headers containing pagination information.
 */
export function getPaginationHeaders(meta) {
  const headers = {
    "X-Total-Count": String(meta.total),
    "X-Limit": String(meta.limit),
  };

  if ("page" in meta) {
    headers["X-Page"] = String(meta.page);
    headers["X-Total-Pages"] = String(meta.totalPages);
    headers["X-Has-Next-Page"] = String(meta.hasNextPage);
    if (meta.hasNextPage) {
      headers["X-Next-Page"] = String(meta.page + 1);
    }
  } else {
    headers["X-Has-More"] = String(meta.hasMore);
    if (meta.nextCursor) {
      headers["X-Next-Cursor"] = meta.nextCursor;
    }
  }

  return headers;
}

/**
 * Creates a standard Response containing payload, pagination meta, and headers.
 */
export function createPaginatedResponse(
  payload,
  meta,
  init
) {
  const headers = new Headers(init?.headers);
  const paginationHeaders = getPaginationHeaders(meta);
  for (const [key, value] of Object.entries(paginationHeaders)) {
    headers.set(key, value);
  }

  return Response.json(
    {
      ...payload,
      pagination: meta,
    },
    {
      ...init,
      headers,
    }
  );
}

/**
 * Express helper to attach pagination headers and send paginated JSON.
 */
export function sendPaginated(res, payload, meta, status = 200) {
  const headers = getPaginationHeaders(meta);
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  return res.status(status).json({
    ...payload,
    pagination: meta,
  });
}

