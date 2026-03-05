import { PrismaClient } from '@prisma/client';

/**
 * Journal Engine Seed — standalone file.
 * Run via docker compose:
 *   docker compose exec backend npx ts-node --transpile-only prisma/seeds/journal_seed.ts
 *
 * Idempotent: checks reference before creating.
 */

const prisma = new PrismaClient();

async function main(): Promise<void> {
    console.log('🌱 Starting journal seed...');

    // Resolve acme-corp tenant
    const tenant = await prisma.tenant.findUnique({ where: { slug: 'acme-corp' } });
    if (!tenant) {
        console.error('❌ Tenant "acme-corp" not found. Run main seed first.');
        process.exit(1);
    }

    // Resolve admin user
    const adminUser = await prisma.user.findFirst({
        where: { tenantId: tenant.id, email: 'admin@acme.com' },
        select: { id: true },
    });
    if (!adminUser) {
        console.error('❌ Admin user not found for tenant acme-corp.');
        process.exit(1);
    }

    // Mark all leaf accounts (level >= 2) as postable for acme-corp
    const updated = await prisma.account.updateMany({
        where: { tenantId: tenant.id, level: { gte: 2 }, isPostable: false },
        data: { isPostable: true },
    });
    console.log(`✅ Marked ${updated.count} leaf accounts as isPostable=true`);

    // Resolve accounts by code
    const getAccount = async (code: string) => {
        const acc = await prisma.account.findUnique({
            where: { tenantId_code: { tenantId: tenant.id, code } },
        });
        if (!acc) throw new Error(`Account ${code} not found for tenant ${tenant.id}`);
        return acc;
    };

    const cashAccount = await getAccount('1110');          // Cash and Cash Equivalents
    const arAccount = await getAccount('1120');            // Accounts Receivable
    const inventoryAccount = await getAccount('1130');     // Inventory
    const salesAccount = await getAccount('4100');         // Sales Revenue
    const cogsAccount = await getAccount('5100');          // Cost of Goods Sold

    // ─── Entry 1: Invoice recognition ──────────────────────────────────────────
    const entry1Exists = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, referenceType: 'INVOICE', description: { contains: 'SEED-DEMO-001' } },
    });

    if (!entry1Exists) {
        await prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                description: 'SEED-DEMO-001: Sales revenue recognition — Invoice INV-2025-0001',
                referenceType: 'INVOICE',
                referenceId: null,
                status: 'POSTED',
                postedAt: new Date('2026-01-15T10:00:00Z'),
                createdBy: adminUser.id,
                lines: {
                    create: [
                        { accountId: arAccount.id, debit: 1889.98, credit: 0, description: 'Accounts Receivable — INV-2025-0001' },
                        { accountId: salesAccount.id, debit: 0, credit: 1889.98, description: 'Sales Revenue' },
                    ],
                },
            },
        });
        console.log('✅ Journal entry 1 (invoice recognition) created');
    } else {
        console.log('⏭️  Journal entry 1 already exists, skipping');
    }

    // ─── Entry 2: Cash receipt / payment settlement ─────────────────────────────
    const entry2Exists = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, referenceType: 'PAYMENT', description: { contains: 'SEED-DEMO-002' } },
    });

    if (!entry2Exists) {
        await prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                description: 'SEED-DEMO-002: Cash receipt for INV-2025-0001',
                referenceType: 'PAYMENT',
                referenceId: null,
                status: 'POSTED',
                postedAt: new Date('2026-01-16T14:00:00Z'),
                createdBy: adminUser.id,
                lines: {
                    create: [
                        { accountId: cashAccount.id, debit: 1889.98, credit: 0, description: 'Cash received' },
                        { accountId: arAccount.id, debit: 0, credit: 1889.98, description: 'A/R cleared' },
                    ],
                },
            },
        });
        console.log('✅ Journal entry 2 (payment settlement) created');
    } else {
        console.log('⏭️  Journal entry 2 already exists, skipping');
    }

    // ─── Entry 3: Inventory purchase ───────────────────────────────────────────
    const entry3Exists = await prisma.journalEntry.findFirst({
        where: { tenantId: tenant.id, referenceType: 'MANUAL', description: { contains: 'SEED-DEMO-003' } },
    });

    if (!entry3Exists) {
        await prisma.journalEntry.create({
            data: {
                tenantId: tenant.id,
                description: 'SEED-DEMO-003: Inventory purchased for resale',
                referenceType: 'MANUAL',
                referenceId: null,
                status: 'POSTED',
                postedAt: new Date('2026-01-10T08:00:00Z'),
                createdBy: adminUser.id,
                lines: {
                    create: [
                        { accountId: inventoryAccount.id, debit: 2500.00, credit: 0, description: 'Inventory stock-in' },
                        { accountId: cashAccount.id, debit: 0, credit: 2500.00, description: 'Cash paid to supplier' },
                    ],
                },
            },
        });
        console.log('✅ Journal entry 3 (inventory purchase) created');
    } else {
        console.log('⏭️  Journal entry 3 already exists, skipping');
    }

    console.log('\n🎉 Journal seed completed!');
}

main()
    .catch((e) => {
        console.error('❌ Journal seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
