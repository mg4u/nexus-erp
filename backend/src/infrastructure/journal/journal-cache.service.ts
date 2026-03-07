import { Injectable, Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.constants';
import { TrialBalanceResult } from '../../application/journal/journal.service';

const TRIAL_BALANCE_PREFIX = 'journal:trial-balance:';
const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class JournalCacheService {
    private readonly logger = new Logger(JournalCacheService.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

    private key(tenantId: string): string {
        return `${TRIAL_BALANCE_PREFIX}${tenantId}`;
    }

    async getTrialBalance(tenantId: string): Promise<TrialBalanceResult | null> {
        try {
            const raw = await this.redis.get(this.key(tenantId));
            if (!raw) return null;
            return JSON.parse(raw) as TrialBalanceResult;
        } catch (err) {
            this.logger.warn(
                `Redis GET failed for trial balance (tenant ${tenantId}): ${(err as Error).message}`,
            );
            return null; // graceful degradation — fall through to DB
        }
    }

    async setTrialBalance(tenantId: string, result: TrialBalanceResult): Promise<void> {
        try {
            await this.redis.setex(
                this.key(tenantId),
                CACHE_TTL_SECONDS,
                JSON.stringify({ ...result, cachedAt: new Date().toISOString() }),
            );
        } catch (err) {
            this.logger.warn(
                `Redis SETEX failed for trial balance (tenant ${tenantId}): ${(err as Error).message}`,
            );
            // Non-fatal: data served from DB; won't be cached this time
        }
    }

    async invalidate(tenantId: string): Promise<void> {
        try {
            // Clear trial balance cache
            await this.redis.del(this.key(tenantId));

            // Clear all report caches for this tenant (P&L, dashboard, etc.)
            const reportKeys = await this.redis.keys(`reports:*:${tenantId}*`);
            if (reportKeys.length > 0) {
                await this.redis.del(...reportKeys);
            }

            this.logger.debug(`Trial balance + report caches invalidated for tenant ${tenantId}`);
        } catch (err) {
            this.logger.warn(
                `Redis cache invalidation failed for tenant ${tenantId}: ${(err as Error).message}`,
            );
        }
    }
}
