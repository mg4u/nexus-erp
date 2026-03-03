import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
    providers: [
        {
            provide: REDIS_CLIENT,
            useFactory: (configService: ConfigService) => {
                const client = new Redis({
                    host: configService.get<string>('redis.host', 'localhost'),
                    port: configService.get<number>('redis.port', 6379),
                    password: configService.get<string>('redis.password') || undefined,
                    lazyConnect: true,
                    retryStrategy: (times: number) => Math.min(times * 100, 3000),
                });
                client.on('connect', () => console.log('Redis connected'));
                client.on('error', (err: Error) => console.error('Redis error:', err.message));
                return client;
            },
            inject: [ConfigService],
        },
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule { }
