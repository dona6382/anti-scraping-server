import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const LOG_LEVELS = ['error', 'warn', 'log', 'debug', 'verbose'] as const;

export class ChangeLogLevelDto {
  @ApiProperty({ enum: LOG_LEVELS, example: 'debug' })
  @IsNotEmpty()
  @IsEnum(LOG_LEVELS)
  level: (typeof LOG_LEVELS)[number];
}
