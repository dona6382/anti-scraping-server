import { ValidationError } from 'class-validator';

/**
 * Validation Utilities
 * 검증 관련 유틸리티 함수들
 */

/**
 * class-validator 에러를 읽기 쉬운 형태로 변환
 */
export function formatValidationErrors(
  errors: ValidationError[]
): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const error of errors) {
    const property = error.property;
    const constraints = error.constraints;

    if (constraints) {
      formatted[property] = Object.values(constraints);
    }

    // 중첩된 객체 검증 에러 처리
    if (error.children && error.children.length > 0) {
      const childErrors = formatValidationErrors(error.children);
      
      for (const [childProperty, childMessages] of Object.entries(childErrors)) {
        formatted[`${property}.${childProperty}`] = childMessages;
      }
    }
  }

  return formatted;
}

/**
 * 이메일 유효성 검사
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * URL 유효성 검사
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 전화번호 정규화
 */
export function normalizePhoneNumber(phone: string): string {
  // 숫자만 추출
  return phone.replace(/\D/g, '');
}

/**
 * 문자열 sanitization
 */
export function sanitizeString(input: string, maxLength?: number): string {
  let sanitized = input
    .trim()
    .replace(/[<>]/g, '') // 기본 XSS 방지
    .replace(/\0/g, ''); // null 바이트 제거

  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * 객체에서 빈 값 제거
 */
export function removeEmptyValues<T extends Record<string, any>>(
  obj: T
): Partial<T> {
  const cleaned: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleanedNested = removeEmptyValues(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key as keyof T] = cleanedNested as T[keyof T];
        }
      } else {
        cleaned[key as keyof T] = value;
      }
    }
  }

  return cleaned;
}

/**
 * 날짜 유효성 검사
 */
export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * 날짜 범위 검사
 */
export function isDateInRange(
  date: Date | string,
  min?: Date | string,
  max?: Date | string
): boolean {
  const targetDate = new Date(date);
  
  if (isNaN(targetDate.getTime())) {
    return false;
  }

  if (min) {
    const minDate = new Date(min);
    if (targetDate < minDate) {
      return false;
    }
  }

  if (max) {
    const maxDate = new Date(max);
    if (targetDate > maxDate) {
      return false;
    }
  }

  return true;
}

/**
 * 파일 확장자 검증
 */
export function isAllowedFileExtension(
  filename: string,
  allowedExtensions: string[]
): boolean {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  if (!extension) {
    return false;
  }

  return allowedExtensions
    .map(ext => ext.toLowerCase().replace('.', ''))
    .includes(extension);
}

/**
 * MIME 타입 검증
 */
export function isAllowedMimeType(
  mimeType: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.some(allowed => {
    if (allowed.endsWith('/*')) {
      // 와일드카드 처리 (예: image/*)
      const prefix = allowed.slice(0, -2);
      return mimeType.startsWith(prefix);
    }
    return mimeType === allowed;
  });
}

/**
 * 숫자 범위 검증
 */
export function isNumberInRange(
  value: number,
  min?: number,
  max?: number
): boolean {
  if (min !== undefined && value < min) {
    return false;
  }
  
  if (max !== undefined && value > max) {
    return false;
  }
  
  return true;
}

/**
 * 배열 중복 제거
 */
export function uniqueArray<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * 객체 깊은 병합
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}
