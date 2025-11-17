import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';

export default function createRedisStore(session) {
    const redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    redisClient.connect().catch(console.error);

    return new RedisStore({
        client: redisClient,
        prefix: 'sess:',
    });
}
