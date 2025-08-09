import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * Base Domain Event
 * 모든 도메인 이벤트의 기본 클래스
 */
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly eventName: string;
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly userId?: string;
  public readonly metadata?: Record<string, any>;

  constructor(
    eventName: string,
    aggregateId: string,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    this.eventId = this.generateEventId();
    this.eventName = eventName;
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
    this.userId = userId;
    this.metadata = metadata;
  }

  private generateEventId(): string {
    return `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Event Bus Service
 * 이벤트 발행 및 구독을 관리
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly eventHistory: DomainEvent[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 이벤트 발행
   */
  async emit(event: DomainEvent): Promise<void> {
    // 이벤트 히스토리 저장
    this.addToHistory(event);
    
    // 로깅
    this.logger.log(`Event emitted: ${event.eventName} - ${event.eventId}`);
    
    // 이벤트 발행
    await this.eventEmitter.emitAsync(event.eventName, event);
    
    // 와일드카드 이벤트 (모든 이벤트 리스너)
    await this.eventEmitter.emitAsync('*', event);
  }

  /**
   * 동기 이벤트 발행
   */
  emitSync(event: DomainEvent): void {
    this.addToHistory(event);
    this.logger.log(`Sync event emitted: ${event.eventName} - ${event.eventId}`);
    this.eventEmitter.emit(event.eventName, event);
  }

  /**
   * 이벤트 히스토리 조회
   */
  getHistory(filter?: {
    eventName?: string;
    aggregateId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
  }): DomainEvent[] {
    let events = [...this.eventHistory];
    
    if (filter) {
      if (filter.eventName) {
        events = events.filter(e => e.eventName === filter.eventName);
      }
      if (filter.aggregateId) {
        events = events.filter(e => e.aggregateId === filter.aggregateId);
      }
      if (filter.userId) {
        events = events.filter(e => e.userId === filter.userId);
      }
      if (filter.startDate) {
        events = events.filter(e => e.occurredAt >= filter.startDate);
      }
      if (filter.endDate) {
        events = events.filter(e => e.occurredAt <= filter.endDate);
      }
    }
    
    return events;
  }

  /**
   * 이벤트 리플레이
   */
  async replay(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.emit(event);
    }
  }

  /**
   * 이벤트 히스토리에 추가
   */
  private addToHistory(event: DomainEvent): void {
    this.eventHistory.push(event);
    
    // 크기 제한
    if (this.eventHistory.length > this.MAX_HISTORY_SIZE) {
      this.eventHistory.shift();
    }
  }
}

/**
 * Event Handler Decorator
 * 에러 처리를 포함한 이벤트 핸들러 데코레이터
 */
export function SafeEventHandler(eventName: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      const logger = new Logger(`${target.constructor.name}.${propertyKey}`);
      
      try {
        logger.debug(`Handling event: ${eventName}`);
        const result = await originalMethod.apply(this, args);
        logger.debug(`Event handled successfully: ${eventName}`);
        return result;
      } catch (error) {
        logger.error(`Error handling event ${eventName}:`, error);
        // 에러를 재발생시키지 않음 (이벤트 처리 실패가 전체 시스템에 영향을 주지 않도록)
      }
    };
    
    // OnEvent 데코레이터 적용
    OnEvent(eventName)(target, propertyKey, descriptor);
    
    return descriptor;
  };
}
