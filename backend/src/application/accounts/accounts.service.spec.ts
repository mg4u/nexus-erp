import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountCacheService } from '../../infrastructure/accounts/account-cache.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const ACCOUNT_ID = 'account-uuid-001';
const PARENT_ID = 'account-uuid-002';

function makeAccount(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: ACCOUNT_ID,
        tenantId: TENANT_ID,
        code: '1000',
        name: 'Cash',
        type: 'ASSET',
        parentId: null,
        level: 0,
        isSystem: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        children: [],
        ...overrides,
    };
}

// ─── Mock factories ────────────────────────────────────────────────────────────

function makePrismaMock(accountOverrides: Partial<Record<string, jest.Mock>> = {}) {
    const mockTx = {
        account: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
        },
    };

    return {
        account: {
            findMany: jest.fn(),
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            count: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            ...accountOverrides,
        },
        $transaction: jest.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
        _mockTx: mockTx, // expose for per-test override
    };
}

function makeCacheMock() {
    return {
        getTree: jest.fn().mockResolvedValue(null),
        setTree: jest.fn().mockResolvedValue(undefined),
        invalidate: jest.fn().mockResolvedValue(undefined),
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AccountsService', () => {
    let service: AccountsService;
    let prisma: ReturnType<typeof makePrismaMock>;
    let cache: ReturnType<typeof makeCacheMock>;

    beforeEach(async () => {
        prisma = makePrismaMock();
        cache = makeCacheMock();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AccountsService,
                { provide: PrismaService, useValue: prisma },
                { provide: AccountCacheService, useValue: cache },
            ],
        }).compile();

        service = module.get<AccountsService>(AccountsService);
    });

    afterEach(() => jest.clearAllMocks());

    // ── create ──────────────────────────────────────────────────────────────

    describe('create', () => {
        it('creates an account when code is unique and no parent', async () => {
            const tx = (prisma as any)._mockTx;
            tx.account.findUnique.mockResolvedValue(null); // no duplicate
            tx.account.create.mockResolvedValue(makeAccount());

            const result = await service.create(TENANT_ID, {
                code: '1000',
                name: 'Cash',
                type: 'ASSET' as any,
            });

            expect(tx.account.findUnique).toHaveBeenCalledWith({
                where: { tenantId_code: { tenantId: TENANT_ID, code: '1000' } },
            });
            expect(tx.account.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ code: '1000', level: 0, isSystem: false }) }),
            );
            expect(cache.invalidate).toHaveBeenCalledWith(TENANT_ID);
            expect(result.code).toBe('1000');
        });

        it('throws ConflictException when account code already exists', async () => {
            const tx = (prisma as any)._mockTx;
            tx.account.findUnique.mockResolvedValue(makeAccount()); // duplicate

            await expect(
                service.create(TENANT_ID, { code: '1000', name: 'Cash', type: 'ASSET' as any }),
            ).rejects.toThrow(ConflictException);
        });

        it('throws NotFoundException when parentId does not belong to tenant', async () => {
            const tx = (prisma as any)._mockTx;
            tx.account.findUnique.mockResolvedValue(null); // no duplicate
            tx.account.findFirst.mockResolvedValue(null);  // parent not found

            await expect(
                service.create(TENANT_ID, { code: '1100', name: 'Current Assets', type: 'ASSET' as any, parentId: PARENT_ID }),
            ).rejects.toThrow(NotFoundException);
        });

        it('sets correct level from parent', async () => {
            const tx = (prisma as any)._mockTx;
            const parent = makeAccount({ id: PARENT_ID, code: '1000', level: 0 });
            tx.account.findUnique.mockResolvedValue(null);
            tx.account.findFirst.mockResolvedValue(parent);
            tx.account.create.mockResolvedValue(makeAccount({ level: 1, parentId: PARENT_ID }));

            const result = await service.create(TENANT_ID, {
                code: '1100',
                name: 'Current Assets',
                type: 'ASSET' as any,
                parentId: PARENT_ID,
            });

            expect(tx.account.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ level: 1, parentId: PARENT_ID }) }),
            );
            expect(result.level).toBe(1);
        });
    });

    // ── getTree ─────────────────────────────────────────────────────────────

    describe('getTree', () => {
        it('returns cached tree when Redis has data', async () => {
            const cachedTree = [makeAccount({ children: [] })] as any;
            cache.getTree.mockResolvedValue(cachedTree);

            const result = await service.getTree(TENANT_ID);

            expect(cache.getTree).toHaveBeenCalledWith(TENANT_ID);
            expect(prisma.account.findMany).not.toHaveBeenCalled();
            expect(result).toBe(cachedTree);
        });

        it('queries DB when cache miss, then stores in cache', async () => {
            cache.getTree.mockResolvedValue(null); // miss
            const accounts = [
                makeAccount({ id: 'root', parentId: null }),
                makeAccount({ id: 'child', parentId: 'root' }),
            ] as any;
            prisma.account.findMany.mockResolvedValue(accounts);

            await service.getTree(TENANT_ID);

            expect(prisma.account.findMany).toHaveBeenCalledWith({
                where: { tenantId: TENANT_ID },
                orderBy: { code: 'asc' },
            });
            expect(cache.setTree).toHaveBeenCalledWith(TENANT_ID, expect.any(Array));
        });

        it('builds correct tree structure from flat list', async () => {
            cache.getTree.mockResolvedValue(null);
            const root = makeAccount({ id: 'r1', parentId: null, code: '1000' });
            const child = makeAccount({ id: 'c1', parentId: 'r1', code: '1100' });
            prisma.account.findMany.mockResolvedValue([root, child] as any);

            const tree = await service.getTree(TENANT_ID);

            expect(tree).toHaveLength(1);
            expect(tree[0].id).toBe('r1');
            expect(tree[0].children).toHaveLength(1);
            expect(tree[0].children[0].id).toBe('c1');
        });
    });

    // ── disable ─────────────────────────────────────────────────────────────

    describe('disable', () => {
        it('disables an active account with no active children', async () => {
            prisma.account.findFirst.mockResolvedValue(makeAccount({ isActive: true }));
            prisma.account.count.mockResolvedValue(0);
            const disabled = makeAccount({ isActive: false });
            prisma.account.update.mockResolvedValue(disabled);

            const result = await service.disable(TENANT_ID, ACCOUNT_ID);

            expect(prisma.account.update).toHaveBeenCalledWith({
                where: { id: ACCOUNT_ID },
                data: { isActive: false },
            });
            expect(cache.invalidate).toHaveBeenCalledWith(TENANT_ID);
            expect(result.isActive).toBe(false);
        });

        it('throws ConflictException when account has active children', async () => {
            prisma.account.findFirst.mockResolvedValue(makeAccount({ isActive: true }));
            prisma.account.count.mockResolvedValue(3); // 3 active children

            await expect(service.disable(TENANT_ID, ACCOUNT_ID)).rejects.toThrow(ConflictException);
            expect(prisma.account.update).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when account does not exist', async () => {
            prisma.account.findFirst.mockResolvedValue(null);

            await expect(service.disable(TENANT_ID, ACCOUNT_ID)).rejects.toThrow(NotFoundException);
        });
    });

    // ── delete ──────────────────────────────────────────────────────────────

    describe('delete', () => {
        it('deletes a non-system account with no children', async () => {
            prisma.account.findFirst.mockResolvedValue(makeAccount({ isSystem: false }));
            prisma.account.count.mockResolvedValue(0);

            await service.delete(TENANT_ID, ACCOUNT_ID);

            expect(prisma.account.delete).toHaveBeenCalledWith({ where: { id: ACCOUNT_ID } });
            expect(cache.invalidate).toHaveBeenCalledWith(TENANT_ID);
        });

        it('throws ForbiddenException when account is a system account', async () => {
            prisma.account.findFirst.mockResolvedValue(makeAccount({ isSystem: true }));

            await expect(service.delete(TENANT_ID, ACCOUNT_ID)).rejects.toThrow(ForbiddenException);
            expect(prisma.account.delete).not.toHaveBeenCalled();
        });

        it('throws ConflictException when account has children', async () => {
            prisma.account.findFirst.mockResolvedValue(makeAccount({ isSystem: false }));
            prisma.account.count.mockResolvedValue(2); // 2 children

            await expect(service.delete(TENANT_ID, ACCOUNT_ID)).rejects.toThrow(ConflictException);
            expect(prisma.account.delete).not.toHaveBeenCalled();
        });

        it('throws NotFoundException when account does not exist', async () => {
            prisma.account.findFirst.mockResolvedValue(null);

            await expect(service.delete(TENANT_ID, ACCOUNT_ID)).rejects.toThrow(NotFoundException);
        });
    });

    // ── domain entity ────────────────────────────────────────────────────────

    describe('AccountEntity (domain rules)', () => {
        it('validates correct account codes', () => {
            // Import inline to test domain independently
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { AccountEntity } = require('../../domain/accounts/account.entity') as {
                AccountEntity: { isValidCode: (c: string) => boolean };
            };
            expect(AccountEntity.isValidCode('1000')).toBe(true);
            expect(AccountEntity.isValidCode('1-100')).toBe(true);
            expect(AccountEntity.isValidCode('1.100')).toBe(true);
            expect(AccountEntity.isValidCode('')).toBe(false);
            expect(AccountEntity.isValidCode('!invalid')).toBe(false);
        });
    });
});
