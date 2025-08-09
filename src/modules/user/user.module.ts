import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { CommonModule } from '../../common/common.module';

/**
 * User Module
 * 사용자 관련 기능을 제공하는 모듈
 */
@Module({
  imports: [CommonModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
