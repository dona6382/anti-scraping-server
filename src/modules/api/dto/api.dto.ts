/**
 * API DTOs
 * API 엔드포인트에서 사용하는 데이터 전송 객체
 */

/**
 * Contact Form DTO
 */
export class ContactFormDto {
  name: string;
  email: string;
  message: string;
  
  // Honeypot fields (should be empty)
  email_confirm?: string;
  name_confirm?: string;
  
  // Hidden fields for bot detection
  _timestamp?: string;
  _jsToken?: string;
  
  // reCAPTCHA token
  recaptchaToken?: string;
}

/**
 * Search Query DTO
 */
export class SearchQueryDto {
  query: string;
  page?: number;
  limit?: number;
  sort?: 'asc' | 'desc';
}

/**
 * User Create DTO
 */
export class CreateUserDto {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * User Update DTO
 */
export class UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

/**
 * Pagination DTO
 */
export class PaginationDto {
  page: number = 1;
  limit: number = 10;
  
  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}

/**
 * API Response wrapper
 */
export class ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Date;
  
  static success<T>(data?: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date(),
    };
  }
  
  static error(error: string, message?: string): ApiResponse {
    return {
      success: false,
      error,
      message,
      timestamp: new Date(),
    };
  }
}

/**
 * Paginated Response
 */
export class PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  
  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrevious = page > 1;
  }
}
