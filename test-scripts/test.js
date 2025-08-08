/**
 * Node.js Test Script for Anti-Scraping Server
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

// Test results
let passed = 0;
let failed = 0;

/**
 * Test helper function
 */
async function test(name, fn) {
  try {
    await fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passed++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    failed++;
  }
}

/**
 * Assert helper
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Main test suite
 */
async function runTests() {
  console.log('\n🧪 Anti-Scraping Server Tests\n');
  
  // Test 1: Health Check
  await test('Health check should return 200', async () => {
    const response = await axios.get(`${API_BASE}/`);
    assert(response.status === 200, `Expected 200, got ${response.status}`);
  });
  
  // Test 2: Public Data
  await test('Public data should be accessible', async () => {
    const response = await axios.get(`${API_BASE}/api/public-data`);
    assert(response.status === 200);
    assert(response.data.status === 'success');
    assert(response.data.data.items.length === 3);
  });
  
  // Test 3: Protected Data with Valid User-Agent
  await test('Protected data should be accessible with valid User-Agent', async () => {
    const response = await axios.get(`${API_BASE}/api/protected-data`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    assert(response.status === 200);
    assert(response.data.data.sensitive);
  });
  
  // Test 4: Protected Data with Invalid User-Agent
  await test('Protected data should block Python requests', async () => {
    try {
      await axios.get(`${API_BASE}/api/protected-data`, {
        headers: {
          'User-Agent': 'python-requests/2.28.1'
        }
      });
      throw new Error('Should have been blocked');
    } catch (error) {
      assert(error.response?.status === 403, `Expected 403, got ${error.response?.status}`);
    }
  });
  
  // Test 5: Protected Data without User-Agent
  await test('Protected data should block requests without User-Agent', async () => {
    try {
      await axios.get(`${API_BASE}/api/protected-data`, {
        headers: {
          'User-Agent': ''
        }
      });
      throw new Error('Should have been blocked');
    } catch (error) {
      assert(error.response?.status === 403);
    }
  });
  
  // Test 6: Rate Limiting
  await test('Rate limiting should allow 3 requests and block the 4th', async () => {
    const endpoint = `${API_BASE}/test/rate-limit`;
    const headers = { 'User-Agent': 'Mozilla/5.0' };
    
    // First 3 requests should pass
    for (let i = 1; i <= 3; i++) {
      const response = await axios.get(endpoint, { headers });
      assert(response.status === 200, `Request ${i} should pass`);
    }
    
    // 4th request should be rate limited
    try {
      await axios.get(endpoint, { headers });
      throw new Error('4th request should be rate limited');
    } catch (error) {
      assert(error.response?.status === 429, `Expected 429, got ${error.response?.status}`);
    }
  });
  
  // Test 7: Honeypot - Normal Submission
  await test('Honeypot should allow normal form submission', async () => {
    const response = await axios.post(`${API_BASE}/test/honeypot`, {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Test message'
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    assert(response.status === 200);
  });
  
  // Test 8: Honeypot - Bot Detection
  await test('Honeypot should block when honeypot field is filled', async () => {
    try {
      await axios.post(`${API_BASE}/test/honeypot`, {
        name: 'Bot',
        email: 'bot@example.com',
        email_confirm: 'bot@example.com', // Honeypot field
        message: 'Spam message'
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });
      throw new Error('Should have been blocked');
    } catch (error) {
      assert(error.response?.status === 403);
    }
  });
  
  // Test 9: Search Endpoint
  await test('Search should work with valid User-Agent', async () => {
    const response = await axios.get(`${API_BASE}/api/search/test`, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    assert(response.status === 200);
    assert(response.data.results.length === 3);
  });
  
  // Test 10: Admin Endpoints
  await test('Admin blacklist stats should be accessible', async () => {
    const response = await axios.get(`${API_BASE}/admin/blacklist/stats`);
    assert(response.status === 200);
    assert(response.data.stats.hasOwnProperty('totalBlacklisted'));
  });
  
  // Print results
  console.log('\n====================================');
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log('====================================\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
