import config from '../config/env.js';

/**
 * Express error responses and validation parsing helpers.
 */

export function formatValidationError(error, details) {
  if (typeof error === "string") {
    return {
      error,
      ...(details && details.length > 0 ? { details } : {}),
    };
  }

  const issueList = error.issues
    ? error.issues.map((issue) => ({
        field: issue.path.join(".") || "root",
        message: issue.message,
      }))
    : [];

  const firstIssue = issueList[0];
  const primaryMessage = firstIssue
    ? `${firstIssue.field !== "root" ? `${firstIssue.field}: ` : ""}${firstIssue.message}`
    : "Validation failed";

  return {
    error: primaryMessage,
    details: issueList,
  };
}

export function sendValidationError(res, error, details) {
  const payload = formatValidationError(error, details);
  return res.status(400).json(payload);
}

export function sendBadRequest(res, message, details) {
  const body = {
    error: message,
    ...(details && details.length > 0 ? { details } : {}),
  };
  return res.status(400).json(body);
}

export function sendUnauthorized(res, message = "Unauthorized") {
  return res.status(401).json({ error: message });
}

export function sendForbidden(res, message = "Forbidden") {
  return res.status(403).json({ error: message });
}

export function sendNotFound(res, message = "Not found") {
  return res.status(404).json({ error: message });
}

export function sendConflict(res, message = "Conflict") {
  return res.status(409).json({ error: message });
}

export function sendInternalError(res, error, fallbackMessage = "Something went wrong") {
  console.error("Internal API error:", error);
  const message = config.IS_PRODUCTION ? "Something went wrong" : fallbackMessage;
  return res.status(500).json({ error: message });
}

export function sendTooManyRequests(res, retryAfterSeconds, limit, remaining, message) {
  const errorMessage =
    message || `Too many requests. Please try again in ${retryAfterSeconds} seconds.`;
  res.setHeader("Retry-After", String(retryAfterSeconds));
  if (limit !== undefined) {
    res.setHeader("X-RateLimit-Limit", String(limit));
  }
  if (remaining !== undefined) {
    res.setHeader("X-RateLimit-Remaining", String(remaining));
  }
  return res.status(429).json({ error: errorMessage });
}

/**
 * Safely parses request body against a Zod schema.
 */
export function parseBody(req, schema) {
  const body = req.body;
  if (body === undefined || body === null) {
    return {
      success: false,
      data: null,
      error: "Invalid JSON in request body",
      details: undefined,
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const formatted = formatValidationError(result.error);
    return {
      success: false,
      data: null,
      error: formatted.error,
      details: formatted.details,
    };
  }

  return {
    success: true,
    data: result.data,
    error: null,
  };
}

/**
 * Parses query params against a Zod schema.
 */
export function parseQuery(query, schema) {
  const result = schema.safeParse(query);
  if (!result.success) {
    const formatted = formatValidationError(result.error);
    return {
      success: false,
      data: null,
      error: formatted.error,
      details: formatted.details,
    };
  }

  return {
    success: true,
    data: result.data,
    error: null,
  };
}

/**
 * Parses route dynamic params against a Zod schema.
 */
export function parseParams(params, schema) {
  const result = schema.safeParse(params);
  if (!result.success) {
    const formatted = formatValidationError(result.error);
    return {
      success: false,
      data: null,
      error: formatted.error,
      details: formatted.details,
    };
  }

  return {
    success: true,
    data: result.data,
    error: null,
  };
}

