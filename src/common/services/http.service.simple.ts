import { Injectable, Logger } from '@nestjs/common';
const axios = require('axios');

/**
 * HTTP 클라이언트 서비스
 * axios를 래핑하여 사용
 */
@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);
  private readonly axiosInstance: any;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 5000,
      headers: {
        'User-Agent': 'Anti-Scraping-Server/1.0',
      },
    });

    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config: any) => {
        this.logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: any) => {
        this.logger.error('HTTP Request Error:', error);
        return Promise.reject(error);
      },
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: any) => {
        this.logger.debug(`HTTP Response: ${response.status} from ${response.config.url}`);
        return response;
      },
      (error: any) => {
        this.logger.error(`HTTP Response Error: ${error.message}`);
        return Promise.reject(error);
      },
    );
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: any): Promise<any> {
    return this.axiosInstance.get(url, config);
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: any,
  ): Promise<any> {
    return this.axiosInstance.post(url, data, config);
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: any,
  ): Promise<any> {
    return this.axiosInstance.put(url, data, config);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: any): Promise<any> {
    return this.axiosInstance.delete(url, config);
  }

  /**
   * Get axios instance for custom operations
   */
  getAxiosInstance(): any {
    return this.axiosInstance;
  }
}
