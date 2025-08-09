import { 
  IsString, 
  IsEnum, 
  IsOptional, 
  IsDateString,
  IsArray,
  IsBoolean
} from 'class-validator';

/**
 * Analytics DTOs
 * 분석 관련 데이터 전송 객체
 */

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
  PDF = 'pdf',
}

export enum AnalyticsType {
  SALES = 'sales',
  USER_BEHAVIOR = 'user_behavior',
  PRODUCT_PERFORMANCE = 'product_performance',
  SECURITY_EVENTS = 'security_events',
  SYSTEM_METRICS = 'system_metrics',
}

export enum DateRange {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  LAST_90_DAYS = 'last_90_days',
  CUSTOM = 'custom',
}

export class ExportAnalyticsDto {
  @IsEnum(AnalyticsType)
  type: AnalyticsType;

  @IsEnum(DateRange)
  dateRange: DateRange;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.CSV;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metrics?: string[];

  @IsOptional()
  @IsBoolean()
  includeCharts?: boolean = false;

  @IsOptional()
  @IsString()
  email?: string;
}

export class AnalyticsReportDto {
  exportId: string;
  type: AnalyticsType;
  dateRange: DateRange;
  format: ExportFormat;
  status: 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  estimatedTime?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export class MetricsDto {
  timestamp: Date;
  metric: string;
  value: number;
  dimensions?: Record<string, any>;
}

export class DashboardMetricsDto {
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
  conversionRate: number;
  averageOrderValue: number;
  topProducts: Array<{ productId: string; sales: number }>;
  securityEvents: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
}
