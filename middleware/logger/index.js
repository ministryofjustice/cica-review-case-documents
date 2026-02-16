import pino from 'pino';
import pinoHttp from 'pino-http';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Builds pino-http redaction configuration from environment variables.
 *
 * @returns {{paths: string[], censor: string}|undefined} Redaction config, or undefined when redaction is disabled.
 */
export function buildRedactConfig() {
    const base = [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'req.body.password',
        'req.body.token',
        'req.body._csrf',
        'res.headers["set-cookie"]'
    ];
    const extra = (process.env.APP_LOG_REDACT_EXTRA || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (process.env.APP_LOG_REDACT_DISABLE === 'true') {
        return undefined;
    }
    return {
        paths: [...base, ...extra],
        censor: '[REDACTED]'
    };
}
/**
 * Creates a configured HTTP logger middleware using pino and pino-http.
 *
 * @param {Object} [options={}] - Optional configuration for the logger.
 * @param {stream.Writable} [options.stream] - Optional stream to write logs to.
 * @param {Object} [options.pinoOptions] - Additional pino logger options (spread into pino configuration).
 * @returns {Function} Express middleware for logging HTTP requests and responses.
 *
 * @example
 * import createLogger from './middleware/logger';
 * const logger = createLogger();
 * app.use(logger);
 *
 * @see {@link https://github.com/pinojs/pino-http}
 * @see {@link https://github.com/pinojs/pino}
 */
function createLogger(options = {}) {
    const { stream, ...pinoOptions } = options;
    const useTransport = !isProd && !stream;
    const logger = pinoHttp({
        logger: pino(
            {
                level: process.env.APP_LOG_LEVEL || (isProd ? 'info' : 'debug'),
                ...(useTransport
                    ? {
                          transport: {
                              target: 'pino-pretty',
                              options: {
                                  colorize: true,
                                  levelFirst: true,
                                  translateTime: 'SYS:standard',
                                  ignore: 'pid,hostname',
                                  singleLine: true
                              }
                          }
                      }
                    : {}),
                ...pinoOptions
            },
            stream
        ),
        redact: buildRedactConfig(),
        customLogLevel: (req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            // TODO consider ability to supress these logs during developemnt
            // return process.env.SUPPRESS_200_LOGS === 'true' ? 'debug' : 'info';
            return 'info';
        },
        genReqId: (req) => {
            return (
                req.headers['x-correlation-id'] ||
                req.headers['x-request-id'] ||
                `${Date.now()}-${Math.random()}`
            );
        },
        customProps: (req, res) => {
            const correlationId =
                req.headers['x-correlation-id'] || req.headers['x-request-id'] || req.id; // result of genReqId().
            return {
                correlationId
            };
        }
    });

    return logger;
}

export default createLogger;
