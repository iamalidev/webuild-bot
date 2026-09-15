import { Module } from '@nestjs/common';
import { CourseModule } from './course/course.module';
import { PaymentModule } from './payment/payment.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [CourseModule, PaymentModule, AdminModule],
  exports: [CourseModule, PaymentModule, AdminModule],
})
export class FeaturesModule {}
