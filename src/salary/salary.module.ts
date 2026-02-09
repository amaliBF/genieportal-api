import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SalaryService } from './salary.service';
import { SalaryController } from './salary.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
