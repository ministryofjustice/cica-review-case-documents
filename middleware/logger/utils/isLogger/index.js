/**
 * Determines if the provided object is a logger instance.
 *
 * Supports detection of:
 * - pino-http middleware (a function with a `.logger` property containing `info` and `child` methods)
 * - bare pino logger instances (objects with `info` and `child` methods)
 *
 * @param {*} logger - The object to test for logger characteristics.
 * @returns {boolean} True if the object is recognized as a logger, false otherwise.
 */
function isLogger(logger) {
    if (!logger) return false;

    // pino-http middleware is a function with .logger property.
    const isPinoHttp =
        typeof logger === 'function' &&
        typeof logger.logger?.info === 'function' &&
        typeof logger.logger?.child === 'function';

    // bare pino instance.
    const isPinoInstance =
        typeof logger?.info === 'function' && typeof logger?.child === 'function';

    return isPinoHttp || isPinoInstance;
}

export default isLogger;
