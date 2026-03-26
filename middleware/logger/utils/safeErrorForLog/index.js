/**
 * Builds a safe error payload for structured logging without serializing request data.
 *
 * @param {any} err - Error-like value to sanitize for logging.
 * @returns {{ name: any, message: any, code: any, statusCode: any, stack?: any }}
 */
export default function safeErrorForLog(err) {
    const payload = {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        statusCode: err?.statusCode ?? err?.response?.statusCode
    };

    if (process.env.NODE_ENV !== 'production' && typeof err?.stack === 'string') {
        payload.stack = err.stack;
    }

    return payload;
}
