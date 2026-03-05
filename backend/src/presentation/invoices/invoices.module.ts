import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from '../../application/invoices/invoices.service';
import { JournalModule } from '../journal/journal.module';

@Module({
    imports: [JournalModule],
    controllers: [InvoicesController],
    providers: [InvoicesService],
})
export class InvoicesModule { }
