/**
 * Integration tests for the logger middleware.
 *
 * These tests verify that the logger:
 * - Logs at the correct level (INFO, WARN, ERROR) based on response status codes.
 * - Includes correlation IDs from headers or generates them if missing.
 * - Structures logs with request and response fields.
 * - Redacts sensitive fields according to environment configuration.
 *
 * @module logger/index.test
 */
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { beforeEach, describe, it } from 'node:test';

import express from 'express';
import request from 'supertest';
import createLogger from './index.js';

describe('Logger integration', () => {
    let app;
    let logStream;
    let lines = [];

    /**
     * Creates a writable stream that captures and parses JSON log entries.
     * Each valid JSON chunk written to the stream is pushed to the `lines` array.
     * Non-JSON chunks are ignored.
     *
     * @returns {Writable} A writable stream for capturing JSON log entries.
     */
    function LogCaptureStream() {
        return new Writable({
            write(chunk, encoding, callback) {
                try {
                    const parsed = JSON.parse(chunk.toString());
                    lines.push(parsed);
                } catch {
                    // ignore non-JSON chunks
                }
                callback();
            }
        });
    }

    beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.APP_LOG_LEVEL = 'info';
        delete process.env.APP_LOG_REDACT_DISABLE;
        delete process.env.APP_LOG_REDACT_EXTRA;

        lines = [];
        const logger = createLogger({
            stream: LogCaptureStream()
        });

        app = express();
        app.use(express.json());
        app.use(logger);

        app.get('/ok', (req, res) => res.status(200).send({ message: 'ok' }));
        app.get('/warn', (req, res) => res.status(404).send({ error: 'not found' }));
        app.get('/error', (req, res) => res.status(500).send({ error: 'boom' }));
        app.post('/redact', (req, res) => res.json(req.body));
    });

    it('should log level INFO for 200 responses', async () => {
        await request(app).get('/ok').set('x-correlation-id', 'abc123');
        const entry = lines.find((l) => l.msg?.includes('request completed'));
        assert.ok(entry);
        assert.strictEqual(entry.level, 30); // info
        assert.strictEqual(entry.correlationId, 'abc123');
    });

    it('should log level WARN for 4xx responses', async () => {
        await request(app).get('/warn');
        const entry = lines.find((l) => l.level === 40);
        assert.ok(entry, 'expected warn log');
    });

    it('should log level ERROR for 5xx responses', async () => {
        await request(app).get('/error');
        const entry = lines.find((l) => l.level === 50);
        assert.ok(entry, 'expected error log');
    });

    it('should use provided correlation id header', async () => {
        await request(app).get('/ok').set('x-correlation-id', 'cid-001');
        const entry = lines.find((l) => l.correlationId === 'cid-001');
        assert.ok(entry, 'expected correlationId in logs');
    });

    it('should generate a request id if header missing', async () => {
        await request(app).get('/ok');
        const entry = lines.find((l) => typeof l.correlationId === 'string');
        assert.ok(
            entry.correlationId.match(/^\d{13}-/),
            'generated correlationId should include timestamp'
        );
    });

    it('should include req and res fields in structured logs', async () => {
        await request(app).get('/ok');
        const entry = lines.find((l) => l.req && l.res);
        assert.ok(entry.req.method);
        assert.ok(entry.req.url);
        assert.strictEqual(typeof entry.res.statusCode, 'number');
    });

    it('should respect extra redaction paths', async () => {
        process.env.APP_LOG_REDACT_EXTRA = 'req.headers.x-custom-secret';
        logStream = new LogCaptureStream();
        const logger = createLogger({ stream: logStream });
        app = express();
        app.use(logger);
        app.get('/extra', (req, res) => res.send('ok'));
        await request(app).get('/extra').set('x-custom-secret', 'foobar');
        const entry = lines.find((l) => l.req);
        assert.strictEqual(entry.req.headers['x-custom-secret'], '[REDACTED]');
    });
});
