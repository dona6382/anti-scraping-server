#!/bin/bash

# ==========================================
# Anti-Scraping Server Test Script
# ==========================================

API_BASE="http://localhost:3000"

echo "🧪 Anti-Scraping Server Tests"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local headers=$3
    local data=$4
    local expected_status=$5
    local test_name=$6
    
    echo -n "Testing: $test_name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -H "$headers" "$API_BASE$endpoint")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" -H "$headers" -H "Content-Type: application/json" -d "$data" "$API_BASE$endpoint")
    fi
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $response)"
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $response)"
    fi
}

echo ""
echo "1. Testing Public Endpoints"
echo "----------------------------"
test_endpoint "GET" "/" "" "" "200" "Health Check"
test_endpoint "GET" "/api/public-data" "" "" "200" "Public Data"

echo ""
echo "2. Testing User-Agent Blocking"
echo "-------------------------------"
test_endpoint "GET" "/api/protected-data" "User-Agent: Mozilla/5.0" "" "200" "Valid User-Agent"
test_endpoint "GET" "/api/protected-data" "User-Agent: python-requests/2.28.1" "" "403" "Python Requests (Blocked)"
test_endpoint "GET" "/api/protected-data" "User-Agent: curl/7.68.0" "" "403" "Curl (Blocked)"
test_endpoint "GET" "/api/protected-data" "" "" "403" "No User-Agent (Blocked)"

echo ""
echo "3. Testing Rate Limiting"
echo "------------------------"
echo -n "Testing: Rate Limit (3 requests in 10s)... "
for i in {1..5}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/test/rate-limit")
    if [ $i -le 3 ]; then
        if [ "$response" != "200" ]; then
            echo -e "${RED}✗ FAILED${NC} (Request $i should pass)"
            break
        fi
    else
        if [ "$response" != "429" ]; then
            echo -e "${RED}✗ FAILED${NC} (Request $i should be rate limited)"
            break
        fi
    fi
    
    if [ $i -eq 5 ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
    fi
done

echo ""
echo "4. Testing Honeypot"
echo "-------------------"
test_endpoint "POST" "/test/honeypot" "User-Agent: Mozilla/5.0" '{"name":"Test","email":"test@example.com"}' "200" "Normal Form Submission"
test_endpoint "POST" "/test/honeypot" "User-Agent: Mozilla/5.0" '{"name":"Test","email":"test@example.com","email_confirm":"bot@test.com"}' "403" "Honeypot Field Filled (Blocked)"

echo ""
echo "5. Testing Admin Endpoints"
echo "--------------------------"
test_endpoint "GET" "/admin/blacklist/stats" "" "" "200" "Blacklist Statistics"
test_endpoint "GET" "/admin/blacklist/ips" "" "" "200" "Get Blacklisted IPs"

echo ""
echo "===================================="
echo "Tests Complete!"
echo ""
