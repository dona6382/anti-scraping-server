// Re-export unified exception filter for backward compatibility
export { UnifiedExceptionFilter } from './global-exception.filter';
export { UnifiedExceptionFilter as GlobalExceptionFilter } from './global-exception.filter';
export { 
  DomainException,
  SecurityException,
  ValidationException,
  ResourceNotFoundException,
  RateLimitException 
} from './global-exception.filter';
