#!/bin/bash

# Raw Error Debug - Get the actual 403 error messages
source .env.local

echo "🔍 Getting Raw 403 Error Messages"
echo "================================="

# Get a token with Patient scope (we know this works)
echo "🔐 Getting token..."
TOKEN_RESPONSE=$(curl -s -X POST "$ATHENA_TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n "$ATHENA_CLIENT_ID:$ATHENA_CLIENT_SECRET" | base64)" \
  -d "grant_type=client_credentials&scope=system/Patient.r")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

echo "✅ Got token"

# Test FHIR endpoints and get raw error messages
echo ""
echo "🧪 Testing FHIR endpoints for raw error messages..."

ENDPOINTS=("/fhir/r4/Patient" "/fhir/r4/Organization" "/fhir/r4/Practitioner")

for ENDPOINT in "${ENDPOINTS[@]}"; do
  echo ""
  echo "Testing: $ENDPOINT"
  echo "URL: $ATHENA_BASE_URL$ENDPOINT"
  
  # Get raw response with headers
  RESPONSE=$(curl -s -i \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Accept: application/fhir+json" \
    "$ATHENA_BASE_URL$ENDPOINT")
  
  echo "Raw Response:"
  echo "$RESPONSE"
  echo "==========================================="
done

echo ""
echo "🎯 Look for the actual error message in the response body!"
echo "Common Athena errors to look for:"
echo "- 'Could not determine what practice the request was for'"
echo "- 'Add the ah-practice search parameter'"
echo "- 'Invalid practice'"
echo "- 'Forbidden'"