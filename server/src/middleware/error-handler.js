export function errorHandler(err, req, res, _next) {
  // Check for body-parser syntax error (malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  // Check for body-parser entity too large (payload limit exceeded)
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(400).json({ error: 'Request payload too large' });
  }

  // Log unexpected errors server-side only
  console.error('[UNHANDLED ERROR]', err);

  // Return standard 500 without leaking error stack/details
  return res.status(500).json({ error: 'Something went wrong' });
}

export default errorHandler;
