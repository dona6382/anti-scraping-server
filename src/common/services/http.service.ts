import { Injectable, Logger } from '@nestjs/common';
import { HttpClientConfig, HttpResponse } from '../../types';

// Axios 타입을 더 안전하게 가져오기
const axios = require('axios');

interface AxiosRequestConfig {
  url?: string;
  method?: string;
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  metadata?: any;
  __retryCount?: number;
}

interface AxiosResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: AxiosRequestConfig;
}

interface AxiosError extends Error {
  config?: AxiosRequestConfig;
  request?: any;
  response?: AxiosResponse;
  isAxiosError?: boolean;
}

/**
 * HTTP 클라이언트 서비스
 * axios를 래핑하여 타입 안전성과 에러 처리를 강화
 */
@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);
  private readonly axiosInstance: any;
  private readonly defaultConfig: HttpClientConfig;

  constructor() {
    this.defaultConfig = {
      timeout: 5000,
      headers: {
        'User-Agent': 'Anti-Scraping-Server/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      retries: 3,
      retryDelay: 1000,
    };

    this.axiosInstance = axios.create({
      timeout: this.defaultConfig.timeout,
      headers: this.defaultConfig.headers,
    });

    this.setupInterceptors();
  }

  /**
   * Request/Response interceptors 설정
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config: AxiosRequestConfig) => {
        this.logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
        
        // 요청 시작 시간 기록
        config.metadata = { startTime: Date.now() };
        
        return config;
      },
      (error: AxiosError) => {
        this.logger.error('HTTP Request Error:', this.formatAxiosError(error));
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        const duration = this.calculateDuration(response.config);
        this.logger.debug(
          `HTTP Response: ${response.status} from ${response.config.url} (${duration}ms)`
        );
        return response;
      },
      async (error: AxiosError) => {
        const duration = error.config ? this.calculateDuration(error.config) : 0;
        this.logger.error(
          `HTTP Response Error: ${error.message} (${duration}ms)`,
          this.formatAxiosError(error)
        );

        // 재시도 로직
        if (this.shouldRetry(error)) {
          return this.retryRequest(error);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    url: string, 
    config?: Partial<AxiosRequestConfig>
  ): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.get<T>(url, config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<AxiosRequestConfig>,
  ): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.post<T>(url, data, config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<AxiosRequestConfig>,
  ): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.put<T>(url, data, config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    url: string, 
    config?: Partial<AxiosRequestConfig>
  ): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<T>(url, config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: Partial<AxiosRequestConfig>,
  ): Promise<HttpResponse<T>> {
    try {
      const response = await this.axiosInstance.patch<T>(url, data, config);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * HEAD request
   */
  async head(
    url: string, 
    config?: Partial<AxiosRequestConfig>
  ): Promise<Pick<HttpResponse, 'status' | 'headers' | 'url'>> {
    try {
      const response = await this.axiosInstance.head(url, config);
      return {
        status: response.status,
        headers: response.headers as Record<string, string>,
        url: response.config.url || url,
      };
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Form 데이터로 POST 요청
   */
  async postForm<T = unknown>(
    url: string,
    formData: Record<string, string | number | boolean>,
    config?: Partial<AxiosRequestConfig>
  ): Promise<HttpResponse<T>> {
    const urlEncodedData = new URLSearchParams();
    Object.entries(formData).forEach(([key, value]) => {
      urlEncodedData.append(key, String(value));
    });

    const formConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    return this.post<T>(url, urlEncodedData.toString(), formConfig);
  }

  /**
   * JSON으로 안전하게 POST 요청
   */
  async postJson<T = unknown>(
    url: string,
    data: Record<string, unknown>,
    config?: Partial<AxiosRequestConfig>
  ): Promise<HttpResponse<T>> {
    const jsonConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'application/json',
      },
    };

    return this.post<T>(url, data, jsonConfig);
  }

  /**
   * 타임아웃이 있는 요청
   */
  async requestWithTimeout<T = unknown>(
    config: AxiosRequestConfig,
    timeoutMs: number
  ): Promise<HttpResponse<T>> {
    const timeoutConfig = {
      ...config,
      timeout: timeoutMs,
    };

    try {
      const response = await this.axiosInstance.request<T>(timeoutConfig);
      return this.formatResponse(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Get axios instance for custom operations
   */
  getAxiosInstance(): any {
    return this.axiosInstance;
  }

  /**
   * 기본 설정 업데이트
   */
  updateDefaultConfig(config: Partial<HttpClientConfig>): void {
    if (config.timeout) {
      this.axiosInstance.defaults.timeout = config.timeout;
    }
    if (config.headers) {
      Object.assign(this.axiosInstance.defaults.headers, config.headers);
    }
  }

  /**
   * 응답을 표준 형식으로 변환
   */
  private formatResponse<T>(response: AxiosResponse<T>): HttpResponse<T> {
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
      url: response.config.url || '',
    };
  }

  /**
   * 에러 처리
   */
  private handleError(error: AxiosError): Error {
    if (error.response) {
      // 서버가 응답했지만 상태 코드가 2xx가 아님
      const message = `HTTP ${error.response.status}: ${error.response.statusText}`;
      const enhancedError = new Error(message);
      (enhancedError as any).status = error.response.status;
      (enhancedError as any).response = error.response.data;
      (enhancedError as any).headers = error.response.headers;
      return enhancedError;
    } else if (error.request) {
      // 요청은 보냈지만 응답을 받지 못함
      return new Error(`Network error: No response received from ${error.config?.url}`);
    } else {
      // 요청 설정 중 에러 발생
      return new Error(`Request configuration error: ${error.message}`);
    }
  }

  /**
   * Axios 에러 포맷팅
   */
  private formatAxiosError(error: AxiosError): Record<string, unknown> {
    return {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    };
  }

  /**
   * 요청 지속 시간 계산
   */
  private calculateDuration(config: AxiosRequestConfig): number {
    const startTime = config.metadata?.startTime;
    return startTime ? Date.now() - startTime : 0;
  }

  /**
   * 재시도 여부 결정
   */
  private shouldRetry(error: AxiosError): boolean {
    // 네트워크 에러이거나 5xx 서버 에러인 경우 재시도
    if (!error.response) {
      return true; // 네트워크 에러
    }

    const status = error.response.status;
    return status >= 500 && status < 600; // 5xx 서버 에러
  }

  /**
   * 요청 재시도
   */
  private async retryRequest(error: AxiosError): Promise<AxiosResponse> {
    const config = error.config;
    if (!config) {
      throw error;
    }

    // 재시도 횟수 체크
    const retryCount = config.__retryCount || 0;
    const maxRetries = this.defaultConfig.retries || 3;

    if (retryCount >= maxRetries) {
      throw error;
    }

    // 재시도 횟수 증가
    config.__retryCount = retryCount + 1;

    // 지연 후 재시도
    const delay = this.defaultConfig.retryDelay || 1000;
    await this.sleep(delay * Math.pow(2, retryCount)); // 지수 백오프

    this.logger.warn(`Retrying request (${retryCount + 1}/${maxRetries}): ${config.url}`);

    return this.axiosInstance.request(config);
  }

  /**
   * 지연 함수
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 요청 취소를 위한 AbortController 생성
   */
  createAbortController(): AbortController {
    return new AbortController();
  }

  /**
   * 취소 가능한 요청
   */
  async requestWithCancel<T = unknown>(
    config: AxiosRequestConfig,
    signal: AbortSignal
  ): Promise<HttpResponse<T>> {
    const cancelConfig = {
      ...config,
      signal,
    };

    try {
      const response = await this.axiosInstance.request<T>(cancelConfig);
      return this.formatResponse(response);
    } catch (error) {
      // axios.isCancel 대신 AbortSignal로 확인
      if (signal.aborted) {
        throw new Error('Request was cancelled');
      }
      throw this.handleError(error as AxiosError);
    }
  }
}
