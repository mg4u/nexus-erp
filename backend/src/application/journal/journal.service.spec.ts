import { Test, TestingModule } from '@nestjs/testing';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalCacheService } from '../../infrastructure/journal/journal-cache.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const ENTRY_ID = 'entry-uuid-001';

function makeAccount(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'account-uuid-001',
        tenantId: TENANT_ID,
        code: '1110',
        name: 'Cash',
        type: 'ASSET',
        isActive: true,
        isPostable: true,
        ...overrides,
    };
}

function makeEntry(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: ENTRY_ID,
        tenantId: TENANT_ID,
        description: 'Test entry',
        status: 'POSTED',
        postedAt: new Date(),
        referenceType: 'MANUAL',
        referenceId: null,
        reversalOf: null,
        createdBy: USER_ID,
        createdAt: new Date(),
        lines: [],
        reversals: [],
        ...overrides,
    };
}

// ─── Mock factories ────────────────────────────────────────────────────────────

function makePrismaMock() {
    const mockTx = {
        account: {
            findMany: jest.fn(),
        },
        journalEntry: {
            create: jest.fn(),
            update: jest.fn(),
            findFirst: jest.fn(),
        },
        journalEntryLine: {
            groupBy: jest.fn(),
            aggregate: jest.fn(),
        },
    };

    return {
        $transaction: jest.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
        _mockTx: mockTx,
        account: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        invoice: { findFirst: jest.fn() },
        payment: { findFirst: jest.fn() },
        journalEntry: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            update: jest.fn(),
        },
        journalEntryLine: {
            groupBy: jest.fn(),
            aggregate: jest.fn(),
        },
    };
}

function makeCacheMock() {
    return {
        getTrialBalance: jest.fn().mockResolvedValue(null),
        setTrialBalance: jest.fn().mockResolvedValue(undefined),
        invalidate: jest.fn().mockResolvedValue(undefined),
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JournalService', () => {
    let service: JournalService;
    let prisma: ReturnType<typeof makePrismaMock>;
    let cache: ReturnType<typeof makeCacheMock>;

    beforeEach(async () => {
        prisma = makePrismaMock();
        cache = makeCacheMock();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                JournalService,
                { provide: PrismaService, useValue: prisma },
                { provide: JournalCacheService, useValue: cache },
            ],
        }).compile();

        service = module.get<JournalService>(JournalService);
    });

    afterEach(() => jest.clearAllMocks());

    // ── postManualEntry ──────────────────────────────────────────────────────

    describe('postManualEntry', () => {
        const validDto = {
            description: 'Rent payment March',
            lines: [
                { accountId: 'acc-1', debit: 1000, credit: 0 },
                { accountId: 'acc-2', debit: 0, credit: 1000 },
            ],
        };

        it('posts entry when debit = credit and all accounts are valid', async () => {
            const tx = (prisma as any)._mockTx;
            tx.account.findMany.mockResolvedValue([
                makeAccount({ id: 'acc-1', code: '5220' }),
                makeAccount({ id: 'acc-2', code: '1110' }),
            ]);
            const createdEntry = { id: ENTRY_ID, lines: [] };
            tx.journalEntry.create.mockResolvedValue(createdEntry);
            tx.journalEntry.update.mockResolvedValue({ ...createdEntry, status: 'POSTED' });

            const result = await service.postManualEntry(TENANT_ID, USER_ID, validDto);

            expect(tx.journalEntry.create).toHaveBeenCalledTimes(1);
            expect(tx.journalEntry.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'POSTED' }) }),
            );
            expect(cache.invalidate).toHaveBeenCalledWith(TENANT_ID);
        });

        it('throws BadRequestException when debit ≠ credit', async () => {
            const badDto = {
                description: 'Unbalanced entry',
                lines: [
                    { accountId: 'acc-1', debit: 1000, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 500 },  // 500 ≠ 1000
                ],
            };

            await expect(service.postManualEntry(TENANT_ID, USER_ID, badDto)).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when a line has zero debit and zero credit', async () => {
            const badDto = {
                description: 'Zero line',
                lines: [
                    { accountId: 'acc-1', debit: 0, credit: 0 },
                    { accountId: 'acc-2', debit: 0, credit: 0 },
                ],
            };

            await expect(service.postManualEntry(TENANT_ID, USER_ID, badDto)).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when fewer than 2 lines', async () => {
            const badDto = {
                description: 'Single line',
                lines: [{ accountId: 'acc-1', debit: 1000, credit: 0 }],
            };

            await expect(service.postManualEntry(TENANT_ID, USER_ID, badDto)).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when account is not postable', async () => {
            const tx = (prisma as any)._mockTx;
            tx.account.findMany.mockResolvedValue([
                makeAccount({ id: 'acc-1', isPostable: false }),
                makeAccount({ id: 'acc-2', code: '1110' }),
            ]);

            await expect(service.postManualEntry(TENANT_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
        });

        it('throws ForbiddenException when account belongs to different tenant', async () => {
            const tx = (prisma as any)._mockTx;
            tx.account.findMany.mockResolvedValue([
                makeAccount({ id: 'acc-1', tenantId: 'other-tenant' }),
                makeAccount({ id: 'acc-2', code: '1110' }),
            ]);

            await expect(service.postManualEntry(TENANT_ID, USER_ID, validDto)).rejects.toThrow(ForbiddenException);
        });

        it('throws BadRequestException when account is inactive', async () => {
            const tx = (prisma as any)._mockTx;
            tx.account.findMany.mockResolvedValue([
                makeAccount({ id: 'acc-1', isActive: false }),
                makeAccount({ id: 'acc-2', code: '1110' }),
            ]);

            await expect(service.postManualEntry(TENANT_ID, USER_ID, validDto)).rejects.toThrow(BadRequestException);
        });
    });

    // ── reverseEntry ─────────────────────────────────────────────────────────

    describe('reverseEntry', () => {
        it('throws ConflictException when entry is already reversed', async () => {
            const tx = (prisma as any)._mockTx;
            tx.journalEntry.findFirst.mockResolvedValue(
                makeEntry({ status: 'POSTED', reversals: [{ id: 'reversal-uuid' }] }),
            );

            await expect(service.reverseEntry(TENANT_ID, USER_ID, ENTRY_ID)).rejects.toThrow(ConflictException);
        });

        it('throws ConflictException when entry is DRAFT (not yet posted)', async () => {
            const tx = (prisma as any)._mockTx;
            tx.journalEntry.findFirst.mockResolvedValue(makeEntry({ status: 'DRAFT', reversals: [] }));

            await expect(service.reverseEntry(TENANT_ID, USER_ID, ENTRY_ID)).rejects.toThrow(ConflictException);
        });

        it('throws NotFoundException when entry does not belong to tenant', async () => {
            const tx = (prisma as any)._mockTx;
            tx.journalEntry.findFirst.mockResolvedValue(null);

            await expect(service.reverseEntry(TENANT_ID, USER_ID, ENTRY_ID)).rejects.toThrow(NotFoundException);
        });
    });

    // ── getTrialBalance ───────────────────────────────────────────────────────

    describe('getTrialBalance', () => {
        it('returns cached result on Redis HIT', async () => {
            const cachedResult = {
                lines: [],
                totalDebit: '0.0000',
                totalCredit: '0.0000',
                isBalanced: true,
                asOfDate: new Date(),
            };
            cache.getTrialBalance.mockResolvedValue(cachedResult);

            const result = await service.getTrialBalance(TENANT_ID, {});

            expect(cache.getTrialBalance).toHaveBeenCalledWith(TENANT_ID);
            expect(prisma.journalEntryLine.groupBy).not.toHaveBeenCalled();
            expect(result).toBe(cachedResult);
        });

        it('queries DB on cache MISS and stores result', async () => {
            cache.getTrialBalance.mockResolvedValue(null);
            prisma.journalEntryLine.groupBy.mockResolvedValue([]);

            await service.getTrialBalance(TENANT_ID, {});

            expect(prisma.journalEntryLine.groupBy).toHaveBeenCalledTimes(1);
            expect(cache.setTrialBalance).toHaveBeenCalledWith(TENANT_ID, expect.any(Object));
        });

        it('does not cache result when asOfDate is custom', async () => {
            prisma.journalEntryLine.groupBy.mockResolvedValue([]);

            await service.getTrialBalance(TENANT_ID, { asOfDate: '2026-01-01' });

            expect(cache.setTrialBalance).not.toHaveBeenCalled();
        });
    });

    // ── validateGlobalEquality ────────────────────────────────────────────────

    describe('validateGlobalEquality', () => {
        it('returns isBalanced true when sum(debit) = sum(credit)', async () => {
            prisma.journalEntryLine.aggregate.mockResolvedValue({
                _sum: { debit: 5000, credit: 5000 },
            });

            const result = await service.validateGlobalEquality(TENANT_ID);

            expect(result.isBalanced).toBe(true);
            expect(result.delta).toBe('0.0000');
        });

        it('returns isBalanced false when sum(debit) ≠ sum(credit)', async () => {
            prisma.journalEntryLine.aggregate.mockResolvedValue({
                _sum: { debit: 5000, credit: 4999.5 },
            });

            const result = await service.validateGlobalEquality(TENANT_ID);

            expect(result.isBalanced).toBe(false);
        });
    });
});
