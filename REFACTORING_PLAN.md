# 🏗️ Refactored Project Structure

```
src/
├── core/                      # 핵심 도메인 로직
│   ├── domain/               # 도메인 모델 & 인터페이스
│   │   ├── interfaces/       # 인터페이스 정의
│   │   ├── entities/         # 엔티티
│   │   ├── value-objects/    # 값 객체
│   │   └── exceptions/       # 도메인 예외
│   │
│   ├── application/          # 애플리케이션 서비스
│   │   ├── services/         # 비즈니스 로직
│   │   ├── use-cases/        # 유스케이스
│   │   └── ports/            # 포트 (인터페이스)
│   │
│   └── infrastructure/       # 인프라스트럭처
│       ├── adapters/         # 외부 시스템 어댑터
│       ├── persistence/      # 데이터 저장소
│       └── config/           # 설정
│
├── modules/                   # 기능 모듈
│   ├── security/             # 보안 모듈
│   │   ├── guards/           # 가드
│   │   ├── strategies/       # 전략 패턴
│   │   ├── middleware/       # 미들웨어
│   │   └── decorators/       # 데코레이터
│   │
│   ├── health/               # 헬스체크 모듈
│   ├── api/                  # API 모듈
│   └── admin/                # 관리자 모듈
│
├── shared/                    # 공유 모듈
│   ├── constants/            # 상수
│   ├── utils/                # 유틸리티
│   ├── types/                # 타입 정의
│   └── filters/              # 예외 필터
│
└── main.ts                    # 진입점
```
