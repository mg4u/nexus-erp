import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from '../../application/payments/payments.service';
import { JournalModule } from '../journal/journal.module';

@Module({
    imports: [JournalModule],
    controllers: [PaymentsController],
    providers: [PaymentsService],
})
export class PaymentsModule { }
