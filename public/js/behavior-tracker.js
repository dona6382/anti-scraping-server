/**
 * Behavior Tracker
 * 사용자 행동을 추적하여 서버로 전송
 */
(function() {
  'use strict';

  const BehaviorTracker = {
    sessionId: null,
    eventBuffer: [],
    bufferSize: 50,
    sendInterval: 5000, // 5초마다 전송
    lastSendTime: 0,
    
    // 이벤트 타입별 제한
    limits: {
      mouse: 100,
      keyboard: 100,
      click: 50,
      scroll: 50,
      touch: 50,
    },
    
    // 이벤트 카운터
    counters: {
      mouse: 0,
      keyboard: 0,
      click: 0,
      scroll: 0,
      touch: 0,
    },

    /**
     * 추적 시작
     */
    init: function() {
      // 세션 ID 생성
      this.sessionId = this.generateSessionId();
      
      // 이벤트 리스너 등록
      this.attachEventListeners();
      
      // 주기적 전송 시작
      this.startPeriodicSend();
      
      console.log('Behavior tracking initialized:', this.sessionId);
    },

    /**
     * 세션 ID 생성
     */
    generateSessionId: function() {
      return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * 이벤트 리스너 등록
     */
    attachEventListeners: function() {
      // 마우스 이벤트
      this.attachMouseListeners();
      
      // 키보드 이벤트
      this.attachKeyboardListeners();
      
      // 클릭 이벤트
      this.attachClickListeners();
      
      // 스크롤 이벤트
      this.attachScrollListeners();
      
      // 터치 이벤트 (모바일)
      this.attachTouchListeners();
      
      // 포커스 이벤트
      this.attachFocusListeners();
      
      // 페이지 언로드 시 데이터 전송
      window.addEventListener('beforeunload', () => {
        this.sendEvents(true);
      });
    },

    /**
     * 마우스 이벤트 리스너
     */
    attachMouseListeners: function() {
      let lastMouseTime = 0;
      const minInterval = 50; // 최소 50ms 간격
      
      document.addEventListener('mousemove', (e) => {
        const now = Date.now();
        if (now - lastMouseTime < minInterval) return;
        
        if (this.counters.mouse < this.limits.mouse) {
          this.addEvent({
            type: 'mouse',
            data: {
              x: e.clientX,
              y: e.clientY,
              timestamp: now,
              type: 'move',
            }
          });
          
          this.counters.mouse++;
          lastMouseTime = now;
        }
      });
      
      document.addEventListener('mouseenter', (e) => {
        this.addEvent({
          type: 'mouse',
          data: {
            x: e.clientX,
            y: e.clientY,
            timestamp: Date.now(),
            type: 'enter',
          }
        });
      });
      
      document.addEventListener('mouseleave', (e) => {
        this.addEvent({
          type: 'mouse',
          data: {
            x: e.clientX,
            y: e.clientY,
            timestamp: Date.now(),
            type: 'leave',
          }
        });
      });
    },

    /**
     * 키보드 이벤트 리스너
     */
    attachKeyboardListeners: function() {
      const keyDownTimes = new Map();
      
      document.addEventListener('keydown', (e) => {
        if (this.counters.keyboard >= this.limits.keyboard) return;
        
        const now = Date.now();
        keyDownTimes.set(e.key, now);
        
        this.addEvent({
          type: 'keyboard',
          data: {
            key: this.sanitizeKey(e.key),
            keyCode: e.keyCode,
            timestamp: now,
            type: 'keydown',
          }
        });
        
        this.counters.keyboard++;
      });
      
      document.addEventListener('keyup', (e) => {
        if (this.counters.keyboard >= this.limits.keyboard) return;
        
        const now = Date.now();
        const downTime = keyDownTimes.get(e.key);
        const duration = downTime ? now - downTime : 0;
        
        this.addEvent({
          type: 'keyboard',
          data: {
            key: this.sanitizeKey(e.key),
            keyCode: e.keyCode,
            timestamp: now,
            duration: duration,
            type: 'keyup',
          }
        });
        
        keyDownTimes.delete(e.key);
      });
    },

    /**
     * 클릭 이벤트 리스너
     */
    attachClickListeners: function() {
      document.addEventListener('click', (e) => {
        if (this.counters.click >= this.limits.click) return;
        
        this.addEvent({
          type: 'click',
          data: {
            x: e.clientX,
            y: e.clientY,
            button: e.button,
            timestamp: Date.now(),
            pressure: e.pressure || 0,
            target: this.getElementSelector(e.target),
          }
        });
        
        this.counters.click++;
      });
      
      document.addEventListener('dblclick', (e) => {
        this.addEvent({
          type: 'click',
          data: {
            x: e.clientX,
            y: e.clientY,
            button: e.button,
            timestamp: Date.now(),
            doubleClick: true,
            target: this.getElementSelector(e.target),
          }
        });
      });
    },

    /**
     * 스크롤 이벤트 리스너
     */
    attachScrollListeners: function() {
      let lastScrollTime = 0;
      const minInterval = 100; // 최소 100ms 간격
      
      document.addEventListener('wheel', (e) => {
        const now = Date.now();
        if (now - lastScrollTime < minInterval) return;
        if (this.counters.scroll >= this.limits.scroll) return;
        
        this.addEvent({
          type: 'scroll',
          data: {
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            timestamp: now,
          }
        });
        
        this.counters.scroll++;
        lastScrollTime = now;
      });
    },

    /**
     * 터치 이벤트 리스너
     */
    attachTouchListeners: function() {
      if (!('ontouchstart' in window)) return;
      
      document.addEventListener('touchstart', (e) => {
        if (this.counters.touch >= this.limits.touch) return;
        
        const touch = e.touches[0];
        this.addEvent({
          type: 'touch',
          data: {
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now(),
            pressure: touch.force || 0,
            radiusX: touch.radiusX || 0,
            radiusY: touch.radiusY || 0,
            type: 'start',
          }
        });
        
        this.counters.touch++;
      });
      
      document.addEventListener('touchmove', (e) => {
        if (this.counters.touch >= this.limits.touch) return;
        
        const touch = e.touches[0];
        this.addEvent({
          type: 'touch',
          data: {
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now(),
            pressure: touch.force || 0,
            type: 'move',
          }
        });
      });
      
      document.addEventListener('touchend', (e) => {
        this.addEvent({
          type: 'touch',
          data: {
            timestamp: Date.now(),
            type: 'end',
          }
        });
      });
    },

    /**
     * 포커스 이벤트 리스너
     */
    attachFocusListeners: function() {
      document.addEventListener('focus', (e) => {
        this.addEvent({
          type: 'focus',
          data: {
            target: this.getElementSelector(e.target),
            timestamp: Date.now(),
            type: 'focus',
          }
        });
      }, true);
      
      document.addEventListener('blur', (e) => {
        this.addEvent({
          type: 'focus',
          data: {
            target: this.getElementSelector(e.target),
            timestamp: Date.now(),
            type: 'blur',
          }
        });
      }, true);
    },

    /**
     * 이벤트 추가
     */
    addEvent: function(event) {
      this.eventBuffer.push(event);
      
      // 버퍼가 가득 차면 즉시 전송
      if (this.eventBuffer.length >= this.bufferSize) {
        this.sendEvents();
      }
    },

    /**
     * 주기적 전송 시작
     */
    startPeriodicSend: function() {
      setInterval(() => {
        if (this.eventBuffer.length > 0) {
          this.sendEvents();
        }
      }, this.sendInterval);
    },

    /**
     * 이벤트 전송
     */
    sendEvents: function(sync = false) {
      if (this.eventBuffer.length === 0) return;
      
      const events = this.eventBuffer.splice(0, this.bufferSize);
      const payload = {
        sessionId: this.sessionId,
        events: events,
        timestamp: Date.now(),
      };
      
      if (sync) {
        // 동기 전송 (페이지 언로드 시)
        navigator.sendBeacon('/api/behavior/track', JSON.stringify(payload));
      } else {
        // 비동기 전송
        fetch('/api/behavior/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': this.sessionId,
          },
          body: JSON.stringify(payload),
        }).catch(err => {
          console.error('Failed to send behavior data:', err);
          // 실패한 이벤트를 다시 버퍼에 추가
          this.eventBuffer.unshift(...events);
        });
      }
      
      this.lastSendTime = Date.now();
    },

    /**
     * 키 정보 sanitize
     */
    sanitizeKey: function(key) {
      // 비밀번호 등 민감한 정보 보호
      if (key.length === 1) {
        return '*'; // 단일 문자는 마스킹
      }
      return key; // 특수키는 그대로
    },

    /**
     * 요소 선택자 생성
     */
    getElementSelector: function(element) {
      if (!element) return '';
      
      if (element.id) {
        return '#' + element.id;
      }
      
      if (element.className) {
        return '.' + element.className.split(' ').join('.');
      }
      
      return element.tagName.toLowerCase();
    },

    /**
     * 분석 데이터 요청
     */
    requestAnalysis: function() {
      return fetch('/api/behavior/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
        }),
      }).then(res => res.json());
    },

    /**
     * 세션 종료
     */
    endSession: function() {
      this.sendEvents(true);
      
      // 이벤트 리스너 제거는 실제로는 더 복잡합니다
      // 여기서는 간단히 처리
      this.eventBuffer = [];
      this.counters = {
        mouse: 0,
        keyboard: 0,
        click: 0,
        scroll: 0,
        touch: 0,
      };
    },
  };

  // 전역 객체에 노출
  window.BehaviorTracker = BehaviorTracker;

  // 자동 시작
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      BehaviorTracker.init();
    });
  } else {
    BehaviorTracker.init();
  }
})();
