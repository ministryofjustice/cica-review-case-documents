/**
 * Builds a safe error payload for structured logging without serializing request data.
 * Stack traces capture the full error chain including where errors were caught in application code.
 * Cause errors are included to preserve the full error chain for debugging.
 *
 * @param {any} err - Error-like value to sanitize for logging.
 * @returns {{ name: any, message: any, code: any, statusCode: any, stack?: any, cause?: any }}
 */
export default function safeErrorForLog(err) {
    const payload = {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        statusCode: err?.statusCode ?? err?.response?.statusCode
    };

    if (typeof err?.stack === 'string') {
        payload.stack = err.stack;
    }

    // Include cause error details to preserve full error chain
    if (err?.cause) {
        payload.cause = {
            name: err.cause.name,
            message: err.cause.message,
            code: err.cause.code,
            stack: err.cause.stack
        };
    }

    return payload;
}
