import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '../../infrastructure/cache/redis.constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-uuid-001';

function makeRedisMock() {
    return {
        get: jest.fn().mockResolvedValue(null),
        setex: jest.fn().mockResolvedValue('OK'),
        keys: jest.fn().mockResolvedValue([]),
        del: jest.fn().mockResolvedValue(0),
    };
}

function makePrismaMock() {
    return {
        journalEntryLine: {
            groupBy: jest.fn().mockResolvedValue([]),
        },
        account: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        // Stubs for other methods (not under test here)
        customer: { count: jest.fn() },
        product: { count: jest.fn() },
        order: { count: jest.fn() },
        invoice: { count: jest.fn() },
        payment: { aggregate: jest.fn(), findMany: jest.fn() },
        orderItem: { groupBy: jest.fn(), findMany: jest.fn() },
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportsService – getProfitLoss', () => {
    let service: ReportsService;
    let prisma: ReturnType<typeof makePrismaMock>;
    let redis: ReturnType<typeof makeRedisMock>;

    beforeEach(async () => {
        prisma = makePrismaMock();
        redis = makeRedisMock();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportsService,
                { provide: PrismaService, useValue: prisma },
                { provide: REDIS_CLIENT, useValue: redis },
            ],
        }).compile();

        service = module.get<ReportsService>(ReportsService);
    });

    afterEach(() => jest.clearAllMocks());

    // ── Returns empty result when no journal data ────────────────────────────

    it('returns zero totals when no matching entries exist', async () => {
        prisma.journalEntryLine.groupBy.mockResolvedValue([]);

        const result = await service.getProfitLoss(TENANT_ID, '2026-01-01', '2026-01-31');

        expect(result.totalRevenue).toBe('0.0000');
        expect(result.totalExpenses).toBe('0.0000');
        expect(result.netProfit).toBe('0.0000');
        expect(result.isProfit).toBe(true);
        expect(result.revenueLines).toEqual([]);
        expect(result.expenseLines).toEqual([]);
    });

    // ── Correct revenue/expense calculation ──────────────────────────────────

    it('calculates correct revenue and expense totals', async () => {
        prisma.journalEntryLine.groupBy.mockResolvedValue([
            { accountId: 'rev-1', _sum: { debit: 0, credit: 5000 } },
            { accountId: 'rev-2', _sum: { debit: 0, credit: 3000 } },
            { accountId: 'exp-1', _sum: { debit: 2000, credit: 0 } },
            { accountId: 'exp-2', _sum: { debit: 1500, credit: 0 } },
        ]);
        prisma.account.findMany.mockResolvedValue([
            { id: 'rev-1', code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
            { id: 'rev-2', code: '4200', name: 'Service Revenue', type: 'REVENUE' },
            { id: 'exp-1', code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE' },
            { id: 'exp-2', code: '5200', name: 'Operating Expenses', type: 'EXPENSE' },
        ]);

        const result = await service.getProfitLoss(TENANT_ID, '2026-01-01', '2026-01-31');

        expect(result.totalRevenue).toBe('8000.0000');
        expect(result.totalExpenses).toBe('3500.0000');
        expect(result.netProfit).toBe('4500.0000');
        expect(result.isProfit).toBe(true);
        expect(result.revenueLines).toHaveLength(2);
        expect(result.expenseLines).toHaveLength(2);
    });

    // ── Net loss when expenses > revenue ──────────────────────────────────────

    it('calculates net loss when expenses exceed revenue', async () => {
        prisma.journalEntryLine.groupBy.mockResolvedValue([
            { accountId: 'rev-1', _sum: { debit: 0, credit: 2000 } },
            { accountId: 'exp-1', _sum: { debit: 5000, credit: 0 } },
        ]);
        prisma.account.findMany.mockResolvedValue([
            { id: 'rev-1', code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
            { id: 'exp-1', code: '5100', name: 'COGS', type: 'EXPENSE' },
        ]);

        const result = await service.getProfitLoss(TENANT_ID, '2026-01-01', '2026-01-31');

        expect(result.netProfit).toBe('-3000.0000');
        expect(result.isProfit).toBe(false);
    });

    // ── Uses cached data on Redis hit ────────────────────────────────────────

    it('returns cached result on Redis HIT', async () => {
        const cachedResult = {
            dateFrom: '2026-01-01',
            dateTo: '2026-01-31',
            revenueLines: [],
            expenseLines: [],
            totalRevenue: '1000.0000',
            totalExpenses: '500.0000',
            netProfit: '500.0000',
            isProfit: true,
        };
        redis.get.mockResolvedValue(JSON.stringify(cachedResult));

        const result = await service.getProfitLoss(TENANT_ID, '2026-01-01', '2026-01-31');

        expect(result.totalRevenue).toBe('1000.0000');
        expect(prisma.journalEntryLine.groupBy).not.toHaveBeenCalled();
    });

    // ── Only POSTED entries are queried ───────────────────────────────────────

    it('queries only POSTED journal entries', async () => {
        prisma.journalEntryLine.groupBy.mockResolvedValue([]);

        await service.getProfitLoss(TENANT_ID, '2026-01-01', '2026-01-31');

        expect(prisma.journalEntryLine.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    journalEntry: expect.objectContaining({
                        status: 'POSTED',
                    }),
                }),
            }),
        );
    });

    // ── Tenant isolation enforced ────────────────────────────────────────────

    it('enforces tenant isolation in query', async () => {
        prisma.journalEntryLine.groupBy.mockResolvedValue([]);

        await service.getProfitLoss(TENANT_ID, '2026-01-01', '2026-01-31');

        expect(prisma.journalEntryLine.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    account: expect.objectContaining({ tenantId: TENANT_ID }),
                    journalEntry: expect.objectContaining({ tenantId: TENANT_ID }),
                }),
            }),
        );
    });

    // ── Revenue lines sorted by account code ─────────────────────────────────

    it('sorts revenue and expense lines by account code', async () => {
        prisma.journalEntryLine.groupBy.mockResolvedValue([
            { accountId: 'rev-2', _sum: { debit: 0, credit: 3000 } },
            { accountId: 'rev-1', _sum: { debit: 0, credit: 5000 } },
        ]);
        prisma.account.findMany.mockResolvedValue([
            { id: 'rev-2', code: '4200', name: 'Service Revenue', type: 'REVENUE' },
            { id: 'rev-1', code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
        ]);

        const result = await service.getProfitLoss(TENANT_ID, '2026-01-01', '2026-01-31');

        expect(result.revenueLines[0].accountCode).toBe('4100');
        expect(result.revenueLines[1].accountCode).toBe('4200');
    });
});
