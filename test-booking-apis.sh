#!/bin/bash
# test-booking-apis.sh
# Comprehensive test script to validate booking APIs and prevent data format errors

echo "🧪 Booking API Test Suite"
echo "========================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default to localhost, allow override
BASE_URL=${BASE_URL:-"http://localhost:3000"}

echo "🔍 Testing against: $BASE_URL"
echo

# Test 1: API Contract Validation
echo -e "${BLUE}Test 1: API Contract Validation${NC}"
echo "================================="

CONTRACT_RESULT=$(curl -s "$BASE_URL/api/debug/validate-api-contracts")
CONTRACT_STATUS=$(echo "$CONTRACT_RESULT" | grep -o '"pass_rate":[0-9]*' | cut -d':' -f2)

if [ "$CONTRACT_STATUS" = "100" ]; then
    echo -e "${GREEN}✅ API contracts validation: PASSED (100% pass rate)${NC}"
else
    echo -e "${RED}❌ API contracts validation: FAILED (${CONTRACT_STATUS}% pass rate)${NC}"
    echo "   Run this for details: curl $BASE_URL/api/debug/validate-api-contracts"
fi
echo

# Test 2: Integration Test
echo -e "${BLUE}Test 2: Booking Flow Integration Test${NC}"
echo "====================================="

INTEGRATION_RESULT=$(curl -s "$BASE_URL/api/debug/test-booking-integration")
INTEGRATION_STATUS=$(echo "$INTEGRATION_RESULT" | grep -o '"status":"[A-Z]*"' | head -1 | cut -d'"' -f4)

if [ "$INTEGRATION_STATUS" = "PASS" ]; then
    echo -e "${GREEN}✅ Integration test: PASSED${NC}"
else
    echo -e "${RED}❌ Integration test: FAILED${NC}"
    echo "   Run this for details: curl $BASE_URL/api/debug/test-booking-integration"
fi
echo

# Test 3: Quick Availability Check
echo -e "${BLUE}Test 3: Quick Availability Check${NC}"
echo "================================="

AVAILABILITY_RESULT=$(curl -s -X POST "$BASE_URL/api/patient-booking/merged-availability" \
    -H "Content-Type: application/json" \
    -d '{"payer_id": "8bd0bedb-226e-4253-bfeb-46ce835ef2a8", "date": "'$(date -v+1d +%Y-%m-%d)'", "language": "English"}')

SLOT_COUNT=$(echo "$AVAILABILITY_RESULT" | grep -o '"totalSlots":[0-9]*' | cut -d':' -f2)

if [ ! -z "$SLOT_COUNT" ] && [ "$SLOT_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Availability check: PASSED ($SLOT_COUNT slots found)${NC}"
else
    echo -e "${RED}❌ Availability check: FAILED (0 slots found)${NC}"
    echo "   This could indicate a data format mismatch!"
fi
echo

# Test 4: Provider Data Check
echo -e "${BLUE}Test 4: Provider Data Validation${NC}"
echo "=================================="

PROVIDER_RESULT=$(curl -s -X POST "$BASE_URL/api/patient-booking/providers-for-payer" \
    -H "Content-Type: application/json" \
    -d '{"payer_id": "8bd0bedb-226e-4253-bfeb-46ce835ef2a8", "language": "English"}')

PROVIDER_COUNT=$(echo "$PROVIDER_RESULT" | grep -o '"total_providers":[0-9]*' | cut -d':' -f2)

if [ ! -z "$PROVIDER_COUNT" ] && [ "$PROVIDER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Provider data check: PASSED ($PROVIDER_COUNT providers found)${NC}"
else
    echo -e "${RED}❌ Provider data check: FAILED (0 providers found)${NC}"
fi
echo

# Summary
echo -e "${BLUE}Summary${NC}"
echo "======="

ALL_TESTS_PASSED=true

if [ "$CONTRACT_STATUS" != "100" ] || [ "$INTEGRATION_STATUS" != "PASS" ] || [ -z "$SLOT_COUNT" ] || [ "$SLOT_COUNT" = "0" ] || [ -z "$PROVIDER_COUNT" ] || [ "$PROVIDER_COUNT" = "0" ]; then
    ALL_TESTS_PASSED=false
fi

if [ "$ALL_TESTS_PASSED" = true ]; then
    echo -e "${GREEN}🎉 All tests passed! Booking APIs are working correctly.${NC}"
    echo -e "${GREEN}   CalendarView should display availability without errors.${NC}"
    exit 0
else
    echo -e "${RED}🚨 Some tests failed! This could cause \"no availability\" bugs.${NC}"
    echo -e "${YELLOW}   Recommendations:${NC}"
    echo "   1. Check API field names match CalendarView expectations"
    echo "   2. Verify database has availability data"
    echo "   3. Run detailed test: curl $BASE_URL/api/debug/validate-api-contracts"
    echo "   4. Check dev server logs for errors"
    exit 1
fi