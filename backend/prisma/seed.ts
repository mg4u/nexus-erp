import { PrismaClient, UserRole, OrderStatus, InvoiceStatus, PaymentMethod, AccountType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
    console.log('🌱 Starting database seed...');

    // ─── Tenant 1: Acme Corp ────────────────────────────────
    const acmeTenant = await prisma.tenant.upsert({
        where: { slug: 'acme-corp' },
        update: {},
        create: {
            name: 'Acme Corporation',
            slug: 'acme-corp',
            plan: 'pro',
            isActive: true,
        },
    });
    console.log(`✅ Tenant created: ${acmeTenant.name} (${acmeTenant.id})`);

    // ─── Users ──────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('Secret123!', 12);

    const adminUser = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: acmeTenant.id, email: 'admin@acme.com' } },
        update: {},
        create: {
            tenantId: acmeTenant.id,
            email: 'admin@acme.com',
            passwordHash,
            firstName: 'Alice',
            lastName: 'Admin',
            role: UserRole.ADMIN,
        },
    });

    const managerUser = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: acmeTenant.id, email: 'manager@acme.com' } },
        update: {},
        create: {
            tenantId: acmeTenant.id,
            email: 'manager@acme.com',
            passwordHash,
            firstName: 'Bob',
            lastName: 'Manager',
            role: UserRole.MANAGER,
        },
    });

    const accountantUser = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: acmeTenant.id, email: 'accountant@acme.com' } },
        update: {},
        create: {
            tenantId: acmeTenant.id,
            email: 'accountant@acme.com',
            passwordHash,
            firstName: 'Carol',
            lastName: 'Accountant',
            role: UserRole.ACCOUNTANT,
        },
    });

    console.log(`✅ Users created: ${adminUser.email}, ${managerUser.email}, ${accountantUser.email}`);

    // ─── Products ───────────────────────────────────────────
    const products = await Promise.all([
        prisma.product.upsert({
            where: { tenantId_sku: { tenantId: acmeTenant.id, sku: 'LAPTOP-001' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                name: 'Business Laptop Pro',
                description: '15-inch, 16GB RAM, 512GB SSD',
                sku: 'LAPTOP-001',
                price: 1299.99,
                stockQuantity: 50,
                category: 'Electronics',
            },
        }),
        prisma.product.upsert({
            where: { tenantId_sku: { tenantId: acmeTenant.id, sku: 'MONITOR-001' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                name: '4K Business Monitor',
                description: '27-inch IPS panel',
                sku: 'MONITOR-001',
                price: 449.99,
                stockQuantity: 30,
                category: 'Electronics',
            },
        }),
        prisma.product.upsert({
            where: { tenantId_sku: { tenantId: acmeTenant.id, sku: 'CHAIR-001' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                name: 'Ergonomic Office Chair',
                description: 'Lumbar support, adjustable armrests',
                sku: 'CHAIR-001',
                price: 299.99,
                stockQuantity: 20,
                category: 'Furniture',
            },
        }),
        prisma.product.upsert({
            where: { tenantId_sku: { tenantId: acmeTenant.id, sku: 'DESK-001' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                name: 'Standing Desk',
                description: 'Height-adjustable, 140cm x 70cm',
                sku: 'DESK-001',
                price: 599.99,
                stockQuantity: 15,
                category: 'Furniture',
            },
        }),
        prisma.product.upsert({
            where: { tenantId_sku: { tenantId: acmeTenant.id, sku: 'SOFTWARE-001' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                name: 'Office Suite License',
                description: 'Annual subscription, 1 user',
                sku: 'SOFTWARE-001',
                price: 149.99,
                stockQuantity: 999,
                category: 'Software',
            },
        }),
    ]);
    console.log(`✅ Products created: ${products.length} items`);

    // ─── Customers ──────────────────────────────────────────
    const customers = await Promise.all([
        prisma.customer.upsert({
            where: { tenantId_email: { tenantId: acmeTenant.id, email: 'john@techcorp.com' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                firstName: 'John',
                lastName: 'Smith',
                email: 'john@techcorp.com',
                phone: '+1-555-0101',
                address: '123 Tech Street',
                city: 'San Francisco',
                country: 'US',
            },
        }),
        prisma.customer.upsert({
            where: { tenantId_email: { tenantId: acmeTenant.id, email: 'sarah@globalco.com' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                firstName: 'Sarah',
                lastName: 'Johnson',
                email: 'sarah@globalco.com',
                phone: '+1-555-0202',
                address: '456 Business Ave',
                city: 'New York',
                country: 'US',
            },
        }),
        prisma.customer.upsert({
            where: { tenantId_email: { tenantId: acmeTenant.id, email: 'mike@startupxyz.com' } },
            update: {},
            create: {
                tenantId: acmeTenant.id,
                firstName: 'Mike',
                lastName: 'Davis',
                email: 'mike@startupxyz.com',
                phone: '+1-555-0303',
                address: '789 Innovation Blvd',
                city: 'Austin',
                country: 'US',
            },
        }),
    ]);
    console.log(`✅ Customers created: ${customers.length} customers`);

    // ─── Orders & Invoices ──────────────────────────────────
    // Idempotent: skip if order with same number already exists for this tenant.

    let order1 = await prisma.order.findFirst({
        where: { tenantId: acmeTenant.id, items: { some: {} } },
        orderBy: { createdAt: 'asc' },
    });

    if (!order1) {
        order1 = await prisma.order.create({
            data: {
                tenantId: acmeTenant.id,
                customerId: customers[0].id,
                status: OrderStatus.DELIVERED,
                subtotal: 1749.98,
                taxAmount: 140.00,
                total: 1889.98,
                items: {
                    create: [
                        { productId: products[0].id, quantity: 1, unitPrice: 1299.99, totalPrice: 1299.99 },
                        { productId: products[1].id, quantity: 1, unitPrice: 449.99, totalPrice: 449.99 },
                    ],
                },
            },
        });
    }

    let invoice1 = await prisma.invoice.findFirst({
        where: { tenantId: acmeTenant.id, invoiceNumber: 'INV-2025-0001' },
    });

    if (!invoice1) {
        invoice1 = await prisma.invoice.create({
            data: {
                tenantId: acmeTenant.id,
                orderId: order1.id,
                invoiceNumber: 'INV-2025-0001',
                status: InvoiceStatus.PAID,
                dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                subtotal: 1749.98,
                taxAmount: 140.00,
                total: 1889.98,
                paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            },
        });
    }

    const existingPayment = await prisma.payment.findFirst({
        where: { tenantId: acmeTenant.id, reference: 'TRF-20250115-001' },
    });

    if (!existingPayment) {
        await prisma.payment.create({
            data: {
                tenantId: acmeTenant.id,
                invoiceId: invoice1.id,
                amount: 1889.98,
                method: PaymentMethod.BANK_TRANSFER,
                reference: 'TRF-20250115-001',
                paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            },
        });
    }

    let order2 = await prisma.order.findFirst({
        where: { tenantId: acmeTenant.id, total: 971.98 },
        orderBy: { createdAt: 'asc' },
    });

    if (!order2) {
        order2 = await prisma.order.create({
            data: {
                tenantId: acmeTenant.id,
                customerId: customers[1].id,
                status: OrderStatus.CONFIRMED,
                subtotal: 899.98,
                taxAmount: 72.00,
                total: 971.98,
                items: {
                    create: [
                        { productId: products[2].id, quantity: 2, unitPrice: 299.99, totalPrice: 599.98 },
                        { productId: products[4].id, quantity: 2, unitPrice: 149.99, totalPrice: 299.98 },
                    ],
                },
            },
        });
    }

    const existingInvoice2 = await prisma.invoice.findFirst({
        where: { tenantId: acmeTenant.id, invoiceNumber: 'INV-2025-0002' },
    });

    if (!existingInvoice2) {
        await prisma.invoice.create({
            data: {
                tenantId: acmeTenant.id,
                orderId: order2.id,
                invoiceNumber: 'INV-2025-0002',
                status: InvoiceStatus.SENT,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                subtotal: 899.98,
                taxAmount: 72.00,
                total: 971.98,
                sentAt: new Date(),
            },
        });
    }

    console.log(`✅ Orders and invoices seeded (skipped if already existed)`);

    // ─── Tenant 2: Second Tenant (for multi-tenancy demo) ───
    const demoTenant = await prisma.tenant.upsert({
        where: { slug: 'demo-startup' },
        update: {},
        create: {
            name: 'Demo Startup Inc.',
            slug: 'demo-startup',
            plan: 'starter',
            isActive: true,
        },
    });

    await prisma.user.upsert({
        where: { tenantId_email: { tenantId: demoTenant.id, email: 'admin@demo.com' } },
        update: {},
        create: {
            tenantId: demoTenant.id,
            email: 'admin@demo.com',
            passwordHash,
            firstName: 'Demo',
            lastName: 'Admin',
            role: UserRole.ADMIN,
        },
    });

    console.log(`✅ Second tenant created: ${demoTenant.name} (${demoTenant.id})`);

    await seedChartOfAccounts(prisma, acmeTenant.id);

    console.log('\n🎉 Seed completed successfully!\n');
    console.log('─────────────────────────────────────────────────');
    console.log('Tenant 1 (Acme Corp):');
    console.log(`  ID:      ${acmeTenant.id}`);
    console.log('  Users:   admin@acme.com, manager@acme.com, accountant@acme.com');
    console.log('  Password: Secret123!');
    console.log('\nTenant 2 (Demo Startup):');
    console.log(`  ID:      ${demoTenant.id}`);
    console.log('  Users:   admin@demo.com');
    console.log('  Password: Secret123!');
    console.log('─────────────────────────────────────────────────');
}

// ─── Chart of Accounts seeder ─────────────────────────────────────────

async function seedChartOfAccounts(prisma: PrismaClient, tenantId: string): Promise<void> {
    type CoaDef = { code: string; name: string; type: AccountType; parentCode?: string; level: number; isPostable?: boolean };

    // Leaf accounts (no children) are marked isPostable: true
    const defs: CoaDef[] = [
        // Assets
        { code: '1000', name: 'Assets', type: 'ASSET', level: 0 },
        { code: '1100', name: 'Current Assets', type: 'ASSET', parentCode: '1000', level: 1 },
        { code: '1110', name: 'Cash and Cash Equivalents', type: 'ASSET', parentCode: '1100', level: 2, isPostable: true },
        { code: '1120', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1100', level: 2, isPostable: true },
        { code: '1130', name: 'Inventory', type: 'ASSET', parentCode: '1100', level: 2, isPostable: true },
        { code: '1200', name: 'Non-Current Assets', type: 'ASSET', parentCode: '1000', level: 1 },
        { code: '1210', name: 'Property, Plant & Equipment', type: 'ASSET', parentCode: '1200', level: 2, isPostable: true },
        // Liabilities
        { code: '2000', name: 'Liabilities', type: 'LIABILITY', level: 0 },
        { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', parentCode: '2000', level: 1 },
        { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2100', level: 2, isPostable: true },
        { code: '2120', name: 'Short-Term Loans', type: 'LIABILITY', parentCode: '2100', level: 2, isPostable: true },
        { code: '2130', name: 'Tax Payable', type: 'LIABILITY', parentCode: '2100', level: 2, isPostable: true },
        { code: '2200', name: 'Non-Current Liabilities', type: 'LIABILITY', parentCode: '2000', level: 1 },
        { code: '2210', name: 'Long-Term Debt', type: 'LIABILITY', parentCode: '2200', level: 2, isPostable: true },
        // Equity
        { code: '3000', name: 'Equity', type: 'EQUITY', level: 0 },
        { code: '3100', name: "Owner's Capital", type: 'EQUITY', parentCode: '3000', level: 1, isPostable: true },
        { code: '3200', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000', level: 1, isPostable: true },
        // Revenue
        { code: '4000', name: 'Revenue', type: 'REVENUE', level: 0 },
        { code: '4100', name: 'Sales Revenue', type: 'REVENUE', parentCode: '4000', level: 1, isPostable: true },
        { code: '4200', name: 'Service Revenue', type: 'REVENUE', parentCode: '4000', level: 1, isPostable: true },
        { code: '4300', name: 'Other Revenue', type: 'REVENUE', parentCode: '4000', level: 1, isPostable: true },
        // Expenses
        { code: '5000', name: 'Expenses', type: 'EXPENSE', level: 0 },
        { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parentCode: '5000', level: 1, isPostable: true },
        { code: '5200', name: 'Operating Expenses', type: 'EXPENSE', parentCode: '5000', level: 1 },
        { code: '5210', name: 'Salaries & Wages', type: 'EXPENSE', parentCode: '5200', level: 2, isPostable: true },
        { code: '5220', name: 'Rent Expense', type: 'EXPENSE', parentCode: '5200', level: 2, isPostable: true },
        { code: '5230', name: 'Marketing & Advertising', type: 'EXPENSE', parentCode: '5200', level: 2, isPostable: true },
        { code: '5300', name: 'Depreciation Expense', type: 'EXPENSE', parentCode: '5000', level: 1, isPostable: true },
        { code: '5400', name: 'Tax Expense', type: 'EXPENSE', parentCode: '5000', level: 1, isPostable: true },
    ];

    const codeToId = new Map<string, string>();
    let seeded = 0;
    let updated = 0;

    for (const def of defs) {
        const existing = await prisma.account.findUnique({
            where: { tenantId_code: { tenantId, code: def.code } },
        });
        if (existing) {
            codeToId.set(def.code, existing.id);
            // Update isPostable if it changed
            const shouldBePostable = def.isPostable ?? false;
            if (existing.isPostable !== shouldBePostable) {
                await prisma.account.update({
                    where: { id: existing.id },
                    data: { isPostable: shouldBePostable },
                });
                updated++;
            }
            continue;
        }
        const parentId = def.parentCode ? (codeToId.get(def.parentCode) ?? null) : null;
        const created = await prisma.account.create({
            data: {
                tenantId,
                code: def.code,
                name: def.name,
                type: def.type,
                parentId,
                level: def.level,
                isSystem: true,
                isActive: true,
                isPostable: def.isPostable ?? false,
            },
        });
        codeToId.set(def.code, created.id);
        seeded++;
    }

    console.log(`✅ Chart of Accounts seeded: ${seeded} created, ${updated} updated for tenant ${tenantId}`);
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
