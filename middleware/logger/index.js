'use strict';

import pinoHttp from 'pino-http';
import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Configured HTTP logger middleware using `pino-http`.
 *
 * Automatically switches between:
 * - **Development mode:** human-readable, colorized logs via `pino-pretty`.
 * - **Production mode:** structured JSON logs suitable for log aggregation.
 *
 * The logger:
 * - Adjusts log levels based on HTTP response codes.
 * - Adds per-request IDs for tracing.
 * - Serializes useful request/response information.
 *
 * @module logger
 * @example
 * import express from 'express';
 * import logger from './logger.js';
 *
 * const app = express();
 * app.use(logger);
 *
 * app.get('/', (req, res) => {
 *   req.log.info('Root endpoint hit');
 *   res.send('Hello, world!');
 * });
 *
 * app.listen(3000, () => {
 *   logger.logger.info('Server listening on port 3000');
 * });
 */

/**
 * @typedef {import('http').IncomingMessage} IncomingMessage
 * @typedef {import('http').ServerResponse} ServerResponse
 */

/**
 * Generate a unique request ID or reuse the one provided in headers.
 *
 * @function genReqId
 * @param {IncomingMessage} req - The incoming HTTP request object.
 * @returns {string} A unique or client-provided request ID.
 */

/**
 * Determine the log level based on response status code or error.
 *
 * @function customLogLevel
 * @param {ServerResponse} res - The HTTP response object.
 * @param {Error} [err] - Optional error object, if one occurred.
 * @returns {'error'|'warn'|'info'} The appropriate log level for the response.
 */

/**
 * Serialize request fields for structured logging.
 *
 * @function reqSerializer
 * @param {IncomingMessage & { id?: string }} req - The HTTP request object.
 * @returns {{ id?: string, method: string, url: string, remoteAddress?: string, userAgent?: string }} Simplified request data.
 */

/**
 * Serialize response fields for structured logging.
 *
 * @function resSerializer
 * @param {ServerResponse} res - The HTTP response object.
 * @returns {{ statusCode: number }} Simplified response data.
 */

/**
 * @type {import('pino-http').HttpLogger}
 */

function createLogger(options = {}) {
    const { stream, ...pinoOptions } = options;
    const useTransport = !isProd && !stream;
    const logger = pinoHttp({
        logger: pino({
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
        }, stream),
        redact: (() => {
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
                .map(s => s.trim())
                .filter(Boolean);
            if (process.env.APP_LOG_REDACT_DISABLE === 'true') {
                return undefined;
            }
            return {
                paths: [...base, ...extra],
                censor: '[REDACTED]'
            };
        })(),
        customLogLevel: (req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
        genReqId: req => {
            return (
                req.headers['x-correlation-id'] ||
                req.headers['x-request-id'] ||
                `${Date.now()}-${Math.random()}`
            );
        },
        customProps: (req, res) => {
            const correlationId =
                req.headers['x-correlation-id'] ||
                req.headers['x-request-id'] ||
                req.id; // result of genReqId().
            return {
                correlationId
            };
        }
    });

    return logger;
}

export default createLogger;
