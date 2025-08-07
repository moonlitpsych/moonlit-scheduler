#!/bin/bash

# Test Different FHIR Base URLs
source .env.local

echo "🔍 Testing Different FHIR Base URLs"
echo "=================================="

# Get token (we know this works)
echo "🔐 Getting token..."
TOKEN=$(curl -s -X POST "$ATHENA_TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n "$ATHENA_CLIENT_ID:$ATHENA_CLIENT_SECRET" | base64)" \
  -d "grant_type=client_credentials&scope=system/Patient.r" | jq -r '.access_token')

echo "✅ Got token: ${TOKEN:0:20}..."

# Test different FHIR base URLs that Athena might use
FHIR_URLS=(
  "https://api.preview.platform.athenahealth.com"                    # Current (not working)
  "https://api.platform.athenahealth.com"                           # Production platform
  "https://api.fhir.athena.io"                                       # FHIR router
  "https://sb.api.platform.athenahealth.com"                        # Sandbox platform  
  "https://preview.api.platform.athenahealth.com"                   # Preview variant
  "https://sandbox.api.platform.athenahealth.com"                   # Sandbox variant
  "https://sb.docs.mydata.athenahealth.com"                         # Docs environment
)

for BASE_URL in "${FHIR_URLS[@]}"; do
  echo ""
  echo "🧪 Testing FHIR Base URL: $BASE_URL"
  
  # Test metadata first (should work if URL is correct)
  echo "   Testing metadata endpoint..."
  METADATA_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/fhir+json" \
    "$BASE_URL/fhir/r4/metadata")
  
  METADATA_STATUS=$(echo $METADATA_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
  METADATA_BODY=$(echo $METADATA_RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
  
  if [ "$METADATA_STATUS" -eq 200 ]; then
    echo "   ✅ Metadata works!"
    FHIR_VERSION=$(echo $METADATA_BODY | jq -r '.fhirVersion // "Unknown"')
    SOFTWARE=$(echo $METADATA_BODY | jq -r '.software.name // "Unknown"')
    echo "   FHIR Version: $FHIR_VERSION"
    echo "   Software: $SOFTWARE"
    
    # If metadata works, test Patient endpoint
    echo "   Testing Patient endpoint..."
    PATIENT_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/fhir+json" \
      "$BASE_URL/fhir/r4/Patient")
    
    PATIENT_STATUS=$(echo $PATIENT_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    PATIENT_BODY=$(echo $PATIENT_RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
    
    if [ "$PATIENT_STATUS" -eq 200 ]; then
      echo "   🎉 PATIENT ENDPOINT WORKS! Found the right URL!"
      PATIENT_COUNT=$(echo $PATIENT_BODY | jq '.total // .entry | length // "No count"')
      echo "   Patient count: $PATIENT_COUNT"
      echo ""
      echo "🏆 SUCCESS! Use this base URL: $BASE_URL"
      break
    elif [ "$PATIENT_STATUS" -eq 403 ]; then
      ERROR_DETAILS=$(echo $PATIENT_BODY | jq -r '.issue[0].details // .issue[0].code // "Unknown error"')
      if [[ $ERROR_DETAILS == *"practice"* ]]; then
        echo "   ⚠️  Need practice context (expected!) - URL is correct"
        echo "   Error: $ERROR_DETAILS"
        echo ""
        echo "🎯 FOUND CORRECT URL! Now test with practice context:"
        echo "   Base URL: $BASE_URL"
        
        # Test with practice context
        echo "   Testing with ah-practice parameter..."
        PRACTICE_TEST=$(curl -s -w "HTTPSTATUS:%{http_code}" \
          -H "Authorization: Bearer $TOKEN" \
          -H "Accept: application/fhir+json" \
          "$BASE_URL/fhir/r4/Patient?ah-practice=demo")
        
        PRACTICE_STATUS=$(echo $PRACTICE_TEST | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
        PRACTICE_BODY=$(echo $PRACTICE_TEST | sed -e 's/HTTPSTATUS\:.*//g')
        
        if [ "$PRACTICE_STATUS" -eq 200 ]; then
          echo "   🎉 COMPLETE SUCCESS with practice context!"
          PATIENT_COUNT=$(echo $PRACTICE_BODY | jq '.total // .entry | length // "No count"')
          echo "   Patient count with practice context: $PATIENT_COUNT"
          echo ""
          echo "🏆 FINAL SOLUTION:"
          echo "   Base URL: $BASE_URL"
          echo "   Practice ID: demo"
          echo "   Always add: ?ah-practice=demo"
          break
        else
          echo "   Still needs different practice ID, but URL is correct"
        fi
        break
      else
        echo "   ❌ Still scope error: $ERROR_DETAILS"
      fi
    else
      echo "   ❌ Unexpected status: $PATIENT_STATUS"
    fi
  else
    echo "   ❌ Metadata failed: $METADATA_STATUS"
    ERROR=$(echo $METADATA_BODY | jq -r '.error // .message // .' 2>/dev/null | head -c 100)
    echo "   Error: $ERROR"
  fi
done

echo ""
echo "🎯 Summary:"
echo "- If we found a working URL above, update your ATHENA_BASE_URL"
echo "- If practice context error, add ah-practice parameter"
echo "- If still all failing, there might be a deeper config issue"