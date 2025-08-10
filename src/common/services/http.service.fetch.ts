import { Injectable, Logger } from '@nestjs/common';

/**
 * HTTP 클라이언트 서비스
 * fetch API를 사용하는 버전 (axios 대신)
 */
@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);
  private readonly defaultHeaders = {
    'User-Agent': 'Anti-Scraping-Server/1.0',
    'Content-Type': 'application/json',
  };
  private readonly timeout = 5000;

  /**
   * GET request
   */
  async get<T = any>(url: string, options?: RequestInit): Promise<T> {
    this.logger.debug(`HTTP Request: GET ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        method: 'GET',
        headers: { ...this.defaultHeaders, ...options?.headers },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.logger.debug(`HTTP Response: ${response.status} from ${url}`);
      return data as T;
    } catch (error) {
      this.logger.error(`HTTP Request Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, options?: RequestInit): Promise<T> {
    this.logger.debug(`HTTP Request: POST ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        method: 'POST',
        headers: { ...this.defaultHeaders, ...options?.headers },
        body: typeof data === 'string' ? data : JSON.stringify(data),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      this.logger.debug(`HTTP Response: ${response.status} from ${url}`);
      return responseData as T;
    } catch (error) {
      this.logger.error(`HTTP Request Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, options?: RequestInit): Promise<T> {
    this.logger.debug(`HTTP Request: PUT ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        method: 'PUT',
        headers: { ...this.defaultHeaders, ...options?.headers },
        body: typeof data === 'string' ? data : JSON.stringify(data),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      this.logger.debug(`HTTP Response: ${response.status} from ${url}`);
      return responseData as T;
    } catch (error) {
      this.logger.error(`HTTP Request Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, options?: RequestInit): Promise<T> {
    this.logger.debug(`HTTP Request: DELETE ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...options,
        method: 'DELETE',
        headers: { ...this.defaultHeaders, ...options?.headers },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.logger.debug(`HTTP Response: ${response.status} from ${url}`);
      return data as T;
    } catch (error) {
      this.logger.error(`HTTP Request Error: ${error.message}`);
      throw error;
    }
  }
}
