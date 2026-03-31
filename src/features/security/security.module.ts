import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { SecurityAdminController } from './controllers/security-admin.controller';

@Module({
  imports: [AuthModule],
  controllers: [SecurityAdminController],
})
export class SecurityModule {}
