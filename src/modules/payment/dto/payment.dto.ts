import { 
  IsString, 
  IsNumber, 
  IsEnum, 
  IsOptional, 
  Min,
  IsCreditCard,
  Length,
  Matches
} from 'class-validator';

/**
 * Payment DTOs
 * 결제 관련 데이터 전송 객체
 */

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer',
  CRYPTO = 'crypto',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  KRW = 'KRW',
  JPY = 'JPY',
}

export class CardDetailsDto {
  @IsCreditCard()
  cardNumber: string;

  @IsString()
  @Length(3, 50)
  cardHolderName: string;

  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
  expiryDate: string; // MM/YY

  @IsString()
  @Length(3, 4)
  cvv: string;
}

export class ProcessPaymentDto {
  @IsString()
  orderId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(Currency)
  currency: Currency = Currency.USD;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  cardDetails?: CardDetailsDto;

  @IsOptional()
  @IsString()
  paypalEmail?: string;

  @IsOptional()
  @IsString()
  cryptoWallet?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class RefundPaymentDto {
  @IsString()
  transactionId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;
}

export class PaymentResponseDto {
  transactionId: string;
  orderId: string;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  status: PaymentStatus;
  processedAt?: Date;
  failureReason?: string;
  refundedAmount?: number;
}

export class PaymentHistoryDto {
  userId: string;
  transactions: PaymentResponseDto[];
  totalSpent: number;
  currency: Currency;
}
