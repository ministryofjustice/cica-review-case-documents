'use strict';

/**
 * Checks whether a passed-in logger looks like a valid pino or pino-http logger.
 *
 * This allows both direct pino instances and pino-http middleware.
 *
 * @param {unknown} logger - The value to check.
 * @returns {boolean} True if the value is a valid logger, false otherwise.
 *
 * @example
 * import pinoHttp from 'pino-http';
 * import pino from 'pino';
 *
 * isLogger(pino()); // true
 * isLogger(pinoHttp()); // true
 * isLogger({ logger: { info: () => {}, child: () => {} } }); // true
 * isLogger({}); // false
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
        typeof logger?.info === 'function' &&
        typeof logger?.child === 'function';
  
    return isPinoHttp || isPinoInstance;
}

export default isLogger;
