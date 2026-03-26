import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyChallengeDto {
  @ApiProperty({ description: 'Challenge token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @ApiProperty({ description: 'PoW nonce solution' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  nonce: string;

  @ApiProperty({ description: 'Browser fingerprint hash (SHA-256 hex)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  fingerprint: string;

  @ApiProperty({ description: 'Return URL after verification', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  returnUrl?: string;
}
