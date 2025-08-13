import { Injectable } from '@nestjs/common';

/**
 * API Service
 * 안티 스크래핑 서버의 API 서비스
 * 비즈니스 모듈들 제거 후 간소화됨
 */
@Injectable()
export class ApiService {
  constructor() {}

  /**
   * 샘플 데이터 제공
   * 안티 스크래핑 기능을 테스트하기 위한 데이터
   */
  async getSampleUserData() {
    return {
      status: 'success',
      data: {
        firstName: "John",
        lastName: "Doe",
        age: 30,
        isStudent: false,
        courses: [
          {
            title: "History 101",
            credits: 3
          },
          {
            title: "Math 202",
            credits: 4
          }
        ],
        address: {
          street: "123 Main St",
          city: "Anytown",
          zipCode: "12345"
        },
        phoneNumbers: [
          "123-456-7890",
          "987-654-3210"
        ],
        email: null
      }
    };
  }

  /**
   * API 상태 확인
   */
  async getApiStatus() {
    return {
      status: 'success',
      message: 'Anti-scraping API is running',
      timestamp: new Date().toISOString(),
      features: [
        'IP Blacklisting',
        'User-Agent Filtering',
        'Rate Limiting',
        'Honeypot Protection',
        'Headless Browser Detection'
      ]
    };
  }
}
