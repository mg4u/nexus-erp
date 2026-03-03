import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super({
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'warn' },
            ],
        });
    }

    async onModuleInit(): Promise<void> {
        await this.$connect();
        this.logger.log('Prisma connected to PostgreSQL');

        // Log slow queries in development
        if (process.env.NODE_ENV !== 'production') {
            (this.$on as any)('query', (event: { query: string; duration: number }) => {
                if (event.duration > 100) {
                    this.logger.warn(`Slow query (${event.duration}ms): ${event.query}`);
                }
            });
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
        this.logger.log('Prisma disconnected');
    }

    async cleanDatabase(): Promise<void> {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('cleanDatabase is not allowed in production!');
        }
        const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;
        for (const { tablename } of tablenames) {
            if (tablename !== '_prisma_migrations') {
                await this.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
            }
        }
    }
}
