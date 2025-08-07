#!/bin/bash

# Athena Health Practice Context Quick Test
# Run this script to test different practice context approaches

# Load environment variables
source .env.local

echo "🔐 Getting OAuth token..."

# Get token
TOKEN_RESPONSE=$(curl -s -X POST "$ATHENA_TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n "$ATHENA_CLIENT_ID:$ATHENA_CLIENT_SECRET" | base64)" \
  -d "grant_type=client_credentials&scope=system/Patient.r")

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ]; then
  echo "❌ Failed to get token: $TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Got access token"

# Test 1: Discover organizations first
echo ""
echo "🔍 Step 1: Discovering available organizations..."
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Accept: application/fhir+json" \
     "$ATHENA_BASE_URL/fhir/r4/Organization" | jq '.entry[]?.resource | {id, name, type}'

# Test 2: Try common sandbox practice IDs with ah-practice parameter
echo ""
echo "🧪 Step 2: Testing common sandbox practice IDs..."

PRACTICE_IDS=("demo" "sandbox" "test" "Organization/a-1.Practice-1" "Organization/a-1.Practice-195000" "Organization/a-1.Practice-432")

for PRACTICE_ID in "${PRACTICE_IDS[@]}"; do
  echo ""
  echo "Testing practice ID: $PRACTICE_ID"
  
  RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Accept: application/fhir+json" \
    "$ATHENA_BASE_URL/fhir/r4/Patient?ah-practice=$PRACTICE_ID")
  
  HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
  BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
  
  if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ SUCCESS with practice ID: $PRACTICE_ID"
    echo "Response: $(echo $BODY | jq '.total // .entry | length // "No data"')"
    
    # If successful, test other resources
    echo "Testing Practitioner resource..."
    curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
         -H "Accept: application/fhir+json" \
         "$ATHENA_BASE_URL/fhir/r4/Practitioner?ah-practice=$PRACTICE_ID" | \
         jq '.total // .entry | length // "No data"'
    
    echo "Testing Appointment resource..."
    curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
         -H "Accept: application/fhir+json" \
         "$ATHENA_BASE_URL/fhir/r4/Appointment?ah-practice=$PRACTICE_ID" | \
         jq '.total // .entry | length // "No data"'
    
    break
  else
    echo "❌ Failed with status $HTTP_STATUS"
    echo "Error: $(echo $BODY | jq -r '.issue[0].details.text // .error // .' 2>/dev/null || echo $BODY)"
  fi
done

echo ""
echo "🎯 Next Steps:"
echo "1. If any practice ID worked, use that for all FHIR requests"
echo "2. Format: ?ah-practice=Organization/a-1.Practice-{ID}"
echo "3. Add this parameter to ALL FHIR resource requests"
echo "4. Update your integration code to include practice context"