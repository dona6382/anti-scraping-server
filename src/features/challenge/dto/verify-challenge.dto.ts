import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

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

  @ApiProperty({ description: 'Puzzle CAPTCHA ID (when puzzle is required)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  puzzleId?: string;

  @ApiProperty({ description: 'CAPTCHA answer text', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  puzzleAnswer?: string;
}
