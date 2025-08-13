/**
 * Browser Fingerprint Collector
 * 브라우저의 고유한 특성을 수집하여 서버로 전송
 */
(function() {
  'use strict';

  const FingerprintCollector = {
    /**
     * Canvas 핑거프린트 생성
     */
    generateCanvasFingerprint: function() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 280;
        canvas.height = 60;
        
        // 복잡한 그래픽 그리기
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        
        ctx.fillStyle = '#069';
        ctx.font = '11pt no-real-font-123';
        ctx.fillText('Canvas fingerprint 🎨 БГД', 2, 15);
        
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.font = '18pt Arial';
        ctx.fillText('BrowserLeaks.com', 4, 45);
        
        // 그라데이션 추가
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, 'red');
        gradient.addColorStop(0.5, 'green');
        gradient.addColorStop(1, 'blue');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 50, 50);
        
        // 곡선 그리기
        ctx.globalCompositeOperation = 'multiply';
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();
        
        // 이미지 데이터를 base64로 변환
        const dataURL = canvas.toDataURL();
        
        // 해시 생성
        return this.hashString(dataURL);
      } catch (e) {
        return 'canvas-error';
      }
    },

    /**
     * WebGL 핑거프린트 생성
     */
    generateWebGLFingerprint: function() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || 
                   canvas.getContext('experimental-webgl');
        
        if (!gl) {
          return { available: false };
        }
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        
        const result = {
          available: true,
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          version: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
          extensions: gl.getSupportedExtensions() || []
        };
        
        if (debugInfo) {
          result.unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          result.unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
        
        // WebGL 이미지 렌더링
        const vertexShaderSource = `
          attribute vec2 a_position;
          void main() {
            gl_Position = vec4(a_position, 0, 1);
          }
        `;
        
        const fragmentShaderSource = `
          precision mediump float;
          void main() {
            gl_FragColor = vec4(0.5, 0.3, 0.8, 1.0);
          }
        `;
        
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexShaderSource);
        gl.compileShader(vertexShader);
        
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentShaderSource);
        gl.compileShader(fragmentShader);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        gl.useProgram(program);
        
        const vertices = new Float32Array([
          -0.5, -0.5,
           0.5, -0.5,
           0.0,  0.5
        ]);
        
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        const positionLocation = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        
        const pixels = new Uint8Array(4);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        result.pixelHash = this.hashString(pixels.join(','));
        
        return result;
      } catch (e) {
        return { available: false, error: e.message };
      }
    },

    /**
     * Audio 핑거프린트 생성
     */
    generateAudioFingerprint: function() {
      return new Promise((resolve) => {
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const context = new AudioContext();
          const oscillator = context.createOscillator();
          const analyser = context.createAnalyser();
          const gainNode = context.createGain();
          const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
          
          gainNode.gain.value = 0; // 무음
          oscillator.type = 'triangle';
          oscillator.frequency.value = 10000;
          
          oscillator.connect(analyser);
          analyser.connect(scriptProcessor);
          scriptProcessor.connect(gainNode);
          gainNode.connect(context.destination);
          
          let fingerprint = '';
          
          scriptProcessor.onaudioprocess = function(event) {
            const output = event.inputBuffer.getChannelData(0);
            let sum = 0;
            
            for (let i = 0; i < output.length; i++) {
              sum += Math.abs(output[i]);
            }
            
            fingerprint = sum.toString();
            
            oscillator.disconnect();
            analyser.disconnect();
            scriptProcessor.disconnect();
            gainNode.disconnect();
            context.close();
            
            resolve(fingerprint);
          };
          
          oscillator.start(0);
          
          // 타임아웃 설정
          setTimeout(() => {
            if (!fingerprint) {
              resolve('audio-timeout');
            }
          }, 1000);
        } catch (e) {
          resolve('audio-error');
        }
      });
    },

    /**
     * 폰트 감지
     */
    detectFonts: function() {
      const baseFonts = ['monospace', 'sans-serif', 'serif'];
      const testFonts = [
        'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria',
        'Century', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Courier',
        'Courier New', 'Georgia', 'Helvetica', 'Impact', 'Lucida Console',
        'Tahoma', 'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana',
        'Wingdings', 'Wingdings 2', 'Wingdings 3'
      ];
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const text = 'mmmmmmmmmmlli';
      const textSize = '72px';
      
      const detectedFonts = [];
      
      // 기본 폰트 너비 측정
      const baseFontWidths = {};
      baseFonts.forEach(baseFont => {
        ctx.font = textSize + ' ' + baseFont;
        baseFontWidths[baseFont] = ctx.measureText(text).width;
      });
      
      // 각 폰트 테스트
      testFonts.forEach(font => {
        let detected = false;
        
        for (const baseFont of baseFonts) {
          ctx.font = textSize + ' "' + font + '",' + baseFont;
          const width = ctx.measureText(text).width;
          
          if (width !== baseFontWidths[baseFont]) {
            detected = true;
            break;
          }
        }
        
        if (detected) {
          detectedFonts.push(font);
        }
      });
      
      return detectedFonts;
    },

    /**
     * WebRTC IP 누출 감지
     */
    detectWebRTCLeak: function() {
      return new Promise((resolve) => {
        const ips = { local: [], public: [] };
        const RTCPeerConnection = window.RTCPeerConnection || 
                                 window.webkitRTCPeerConnection || 
                                 window.mozRTCPeerConnection;
        
        if (!RTCPeerConnection) {
          resolve({ available: false });
          return;
        }
        
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        pc.createDataChannel('');
        
        pc.onicecandidate = (event) => {
          if (!event || !event.candidate || !event.candidate.candidate) {
            resolve({
              available: true,
              localIP: ips.local[0] || null,
              publicIP: ips.public[0] || null,
              leaked: ips.local.length > 0 || ips.public.length > 0
            });
            pc.close();
            return;
          }
          
          const candidate = event.candidate.candidate;
          const ipRegex = /([0-9]{1,3}\.){3}[0-9]{1,3}/;
          const ipMatch = candidate.match(ipRegex);
          
          if (ipMatch) {
            const ip = ipMatch[0];
            if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
              if (!ips.local.includes(ip)) ips.local.push(ip);
            } else {
              if (!ips.public.includes(ip)) ips.public.push(ip);
            }
          }
        };
        
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        // 타임아웃
        setTimeout(() => {
          resolve({
            available: true,
            localIP: ips.local[0] || null,
            publicIP: ips.public[0] || null,
            leaked: ips.local.length > 0 || ips.public.length > 0
          });
          pc.close();
        }, 2000);
      });
    },

    /**
     * 플러그인 감지
     */
    detectPlugins: function() {
      const plugins = [];
      
      if (navigator.plugins) {
        for (let i = 0; i < navigator.plugins.length; i++) {
          plugins.push({
            name: navigator.plugins[i].name,
            filename: navigator.plugins[i].filename,
            description: navigator.plugins[i].description
          });
        }
      }
      
      return plugins;
    },

    /**
     * 브라우저 특성 수집
     */
    collectBrowserFeatures: function() {
      return {
        userAgent: navigator.userAgent,
        language: navigator.language || navigator.userLanguage,
        languages: navigator.languages || [],
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        vendor: navigator.vendor,
        vendorSub: navigator.vendorSub,
        productSub: navigator.productSub,
        onLine: navigator.onLine,
        
        screen: {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth
        },
        
        window: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
          screenX: window.screenX,
          screenY: window.screenY,
          devicePixelRatio: window.devicePixelRatio
        },
        
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        
        // 추가 브라우저 특성
        webdriver: navigator.webdriver,
        bluetooth: navigator.bluetooth ? true : false,
        credentials: navigator.credentials ? true : false,
        keyboard: navigator.keyboard ? true : false,
        managed: navigator.managed ? true : false,
        mediaDevices: navigator.mediaDevices ? true : false,
        storage: navigator.storage ? true : false,
        serviceWorker: navigator.serviceWorker ? true : false,
        virtualKeyboard: navigator.virtualKeyboard ? true : false,
        wakeLock: navigator.wakeLock ? true : false,
        
        // 배터리 상태 (보안상 제거되는 추세)
        getBattery: navigator.getBattery ? true : false,
        
        // 권한 API
        permissions: navigator.permissions ? true : false,
        
        // 미디어 기능
        mediaCapabilities: navigator.mediaCapabilities ? true : false,
        
        // WebGL 확장
        webgl: this.checkWebGLExtensions(),
        
        // Canvas 특성
        canvas: this.checkCanvasFeatures()
      };
    },

    /**
     * WebGL 확장 체크
     */
    checkWebGLExtensions: function() {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) return null;
        
        return {
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
          maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
          maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
          maxVertexUniformVectors: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
          maxFragmentUniformVectors: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
          depthBits: gl.getParameter(gl.DEPTH_BITS),
          stencilBits: gl.getParameter(gl.STENCIL_BITS),
          maxCombinedTextureImageUnits: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)
        };
      } catch (e) {
        return null;
      }
    },

    /**
     * Canvas 특성 체크
     */
    checkCanvasFeatures: function() {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return null;
        
        return {
          winding: ctx.isPointInPath && ctx.isPointInPath(5, 5, 'evenodd') !== undefined,
          toDataURL: canvas.toDataURL ? true : false,
          toBlob: canvas.toBlob ? true : false,
          captureStream: canvas.captureStream ? true : false,
          getImageData: ctx.getImageData ? true : false
        };
      } catch (e) {
        return null;
      }
    },

    /**
     * 문자열 해시 생성
     */
    hashString: function(str) {
      let hash = 0;
      if (str.length === 0) return hash;
      
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      
      return hash.toString(16);
    },

    /**
     * 전체 핑거프린트 수집
     */
    collectFullFingerprint: async function() {
      const fingerprint = {
        canvas: this.generateCanvasFingerprint(),
        webgl: this.generateWebGLFingerprint(),
        audio: await this.generateAudioFingerprint(),
        fonts: this.detectFonts(),
        webrtc: await this.detectWebRTCLeak(),
        plugins: this.detectPlugins(),
        features: this.collectBrowserFeatures(),
        timestamp: new Date().toISOString()
      };
      
      // 고유 ID 생성
      const idComponents = [
        fingerprint.canvas,
        JSON.stringify(fingerprint.webgl),
        fingerprint.audio,
        fingerprint.fonts.join(','),
        fingerprint.features.timezone,
        fingerprint.features.screen.width,
        fingerprint.features.screen.height
      ].join('|');
      
      fingerprint.id = this.hashString(idComponents);
      
      return fingerprint;
    },

    /**
     * 서버로 핑거프린트 전송
     */
    sendToServer: async function(fingerprint) {
      try {
        const response = await fetch('/api/fingerprint/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Fingerprint-Id': fingerprint.id
          },
          body: JSON.stringify(fingerprint)
        });
        
        return await response.json();
      } catch (e) {
        console.error('Failed to send fingerprint:', e);
        return null;
      }
    }
  };

  // 전역 객체에 노출
  window.FingerprintCollector = FingerprintCollector;

  // 자동 실행 (옵션)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      const fingerprint = await FingerprintCollector.collectFullFingerprint();
      console.log('Fingerprint collected:', fingerprint);
      await FingerprintCollector.sendToServer(fingerprint);
    });
  } else {
    // 이미 로드됨
    (async () => {
      const fingerprint = await FingerprintCollector.collectFullFingerprint();
      console.log('Fingerprint collected:', fingerprint);
      await FingerprintCollector.sendToServer(fingerprint);
    })();
  }
})();
