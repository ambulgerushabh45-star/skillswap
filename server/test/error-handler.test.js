import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../src/middleware/error-handler.js';
import { sendInternalError } from '../src/lib/api-error.js';

describe('Central Error Handler Middleware', () => {
  function createMocks() {
    const res = {
      statusCode: 200,
      jsonBody: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    const req = {};
    const next = vi.fn();
    return { req, res, next };
  }

  it('maps JSON syntax errors to 400 Invalid JSON in request body', () => {
    const { req, res, next } = createMocks();
    const err = new SyntaxError('Unexpected token in JSON at position 5');
    err.status = 400;
    err.body = '{ bad: ';

    errorHandler(err, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Invalid JSON in request body' });
  });

  it('maps entity.too.large payload errors to 400 Request payload too large', () => {
    const { req, res, next } = createMocks();
    const err = new Error('request entity too large');
    err.type = 'entity.too.large';
    err.status = 413;

    errorHandler(err, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({ error: 'Request payload too large' });
  });

  it('maps unexpected errors to 500 Something went wrong without leaking internal stack', () => {
    const { req, res, next } = createMocks();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const err = new Error('Database connection failed unexpectedly');
    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ error: 'Something went wrong' });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('sendInternalError returns 500 without leaking sensitive error details', () => {
    const res = {
      statusCode: 200,
      jsonBody: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendInternalError(res, new Error('Sensitive MongoDB stack trace'), 'Something went wrong');
    expect(res.statusCode).toBe(500);
    expect(res.jsonBody.error).toBe('Something went wrong');
    expect(res.jsonBody.error).not.toContain('Sensitive MongoDB stack trace');
    consoleSpy.mockRestore();
  });
});

