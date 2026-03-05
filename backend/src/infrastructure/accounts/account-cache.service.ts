import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.constants';
import { AccountTreeNode } from '../../application/accounts/accounts.service';

const CACHE_PREFIX = 'coa:tree:';
const CACHE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class AccountCacheService {
    private readonly logger = new Logger(AccountCacheService.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) { }

    private key(tenantId: string): string {
        return `${CACHE_PREFIX}${tenantId}`;
    }

    async getTree(tenantId: string): Promise<AccountTreeNode[] | null> {
        try {
            const raw = await this.redis.get(this.key(tenantId));
            if (!raw) return null;
            return JSON.parse(raw) as AccountTreeNode[];
        } catch (err) {
            this.logger.warn(`Redis GET failed for CoA tree (tenant ${tenantId}): ${(err as Error).message}`);
            return null; // graceful degradation — fall through to DB
        }
    }

    async setTree(tenantId: string, tree: AccountTreeNode[]): Promise<void> {
        try {
            await this.redis.setex(this.key(tenantId), CACHE_TTL_SECONDS, JSON.stringify(tree));
        } catch (err) {
            this.logger.warn(`Redis SETEX failed for CoA tree (tenant ${tenantId}): ${(err as Error).message}`);
            // Non-fatal: the data was served from DB, just won't be cached
        }
    }

    async invalidate(tenantId: string): Promise<void> {
        try {
            await this.redis.del(this.key(tenantId));
        } catch (err) {
            this.logger.warn(`Redis DEL failed for CoA tree (tenant ${tenantId}): ${(err as Error).message}`);
        }
    }
}
