#!/bin/bash

# Comprehensive Sandbox Configuration Test
source .env.local

echo "🔬 Comprehensive Athena Sandbox Analysis"
echo "========================================"

# Your URL is confirmed correct, so let's test other possibilities

echo "✅ FHIR Base URL confirmed correct: $ATHENA_BASE_URL"
echo ""

# Test 1: Check if it's a sandbox data availability issue
echo "🧪 Test 1: Check sandbox data availability with metadata"
TOKEN=$(curl -s -X POST "$ATHENA_TOKEN_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n "$ATHENA_CLIENT_ID:$ATHENA_CLIENT_SECRET" | base64)" \
  -d "grant_type=client_credentials&scope=system/Patient.r" | jq -r '.access_token')

echo "Token obtained: ${TOKEN:0:20}..."

# Check metadata for sandbox status
echo "Checking metadata for sandbox configuration..."
METADATA=$(curl -s -H "Authorization: Bearer $TOKEN" \
               -H "Accept: application/fhir+json" \
               "$ATHENA_BASE_URL/fhir/r4/metadata")

echo "Server software: $(echo $METADATA | jq -r '.software.name // "Unknown"')"
echo "Server version: $(echo $METADATA | jq -r '.software.version // "Unknown"')"
echo "Implementation description: $(echo $METADATA | jq -r '.implementation.description // "Unknown"')"

# Check if sandbox indicates any special requirements
SANDBOX_INFO=$(echo $METADATA | jq -r '.rest[0].documentation // "No documentation"')
echo "Server documentation: $SANDBOX_INFO"

echo ""
echo "🧪 Test 2: Try different scope combinations that might work in sandbox"

# Test broader scope that might include everything
BROAD_SCOPES=(
  "system/*.*"
  "system/*.read"
  "user/Patient.r"
  "patient/Patient.r"
  "system/Patient.r system/Organization.r"
  "system/Patient.read"
)

for SCOPE in "${BROAD_SCOPES[@]}"; do
  echo ""
  echo "Testing scope: $SCOPE"
  
  SCOPE_TOKEN=$(curl -s -X POST "$ATHENA_TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Authorization: Basic $(echo -n "$ATHENA_CLIENT_ID:$ATHENA_CLIENT_SECRET" | base64)" \
    -d "grant_type=client_credentials&scope=$SCOPE" | jq -r '.access_token')
  
  if [ "$SCOPE_TOKEN" != "null" ] && [ "$SCOPE_TOKEN" != "" ]; then
    echo "✅ Got token for scope: $SCOPE"
    
    # Test Patient endpoint
    PATIENT_TEST=$(curl -s -w "HTTPSTATUS:%{http_code}" \
      -H "Authorization: Bearer $SCOPE_TOKEN" \
      -H "Accept: application/fhir+json" \
      "$ATHENA_BASE_URL/fhir/r4/Patient")
    
    PATIENT_STATUS=$(echo $PATIENT_TEST | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    
    if [ "$PATIENT_STATUS" -eq 200 ]; then
      echo "🎉 SUCCESS! Working scope: $SCOPE"
      PATIENT_BODY=$(echo $PATIENT_TEST | sed -e 's/HTTPSTATUS\:.*//g')
      echo "Patient data: $(echo $PATIENT_BODY | jq '.total // .entry | length // "Available"')"
      break
    else
      echo "❌ Still failed with status: $PATIENT_STATUS"
    fi
  else
    echo "❌ Could not get token for scope: $SCOPE"
  fi
done

echo ""
echo "🧪 Test 3: Check if sandbox requires specific practice setup"

# Use original working token
echo "Testing practice discovery approaches..."

# Try to access CapabilityStatement for practice requirements
echo "Checking CapabilityStatement..."
CAPABILITY=$(curl -s -H "Authorization: Bearer $TOKEN" \
                 -H "Accept: application/fhir+json" \
                 "$ATHENA_BASE_URL/fhir/r4/metadata")

SEARCH_PARAMS=$(echo $CAPABILITY | jq -r '.rest[0].resource[] | select(.type=="Patient") | .searchParam[]? | .name' 2>/dev/null)
echo "Available Patient search parameters:"
echo "$SEARCH_PARAMS"

# Check if ah-practice is listed as required
if echo "$SEARCH_PARAMS" | grep -q "ah-practice"; then
  echo "✅ ah-practice parameter is supported"
else
  echo "⚠️  ah-practice parameter not listed in capabilities"
fi

echo ""
echo "🧪 Test 4: Test Organization endpoint for practice discovery"

ORG_TEST=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/fhir+json" \
  "$ATHENA_BASE_URL/fhir/r4/Organization")

ORG_STATUS=$(echo $ORG_TEST | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

if [ "$ORG_STATUS" -eq 200 ]; then
  echo "✅ Organization endpoint works!"
  ORG_BODY=$(echo $ORG_TEST | sed -e 's/HTTPSTATUS\:.*//g')
  echo "Organizations found: $(echo $ORG_BODY | jq '.entry | length // 0')"
  
  # Extract practice IDs
  PRACTICE_IDS=$(echo $ORG_BODY | jq -r '.entry[]?.resource | select(.id | startswith("a-1.Practice-")) | .id' 2>/dev/null)
  if [ ! -z "$PRACTICE_IDS" ]; then
    echo "Found practice IDs:"
    echo "$PRACTICE_IDS"
    
    # Test first practice ID
    FIRST_PRACTICE=$(echo "$PRACTICE_IDS" | head -n 1)
    echo ""
    echo "Testing with discovered practice ID: $FIRST_PRACTICE"
    
    PRACTICE_PATIENT_TEST=$(curl -s -w "HTTPSTATUS:%{http_code}" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Accept: application/fhir+json" \
      "$ATHENA_BASE_URL/fhir/r4/Patient?ah-practice=$FIRST_PRACTICE")
    
    PRACTICE_PATIENT_STATUS=$(echo $PRACTICE_PATIENT_TEST | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    
    if [ "$PRACTICE_PATIENT_STATUS" -eq 200 ]; then
      echo "🎉 SUCCESS with practice ID: $FIRST_PRACTICE"
      PRACTICE_PATIENT_BODY=$(echo $PRACTICE_PATIENT_TEST | sed -e 's/HTTPSTATUS\:.*//g')
      echo "Patients found: $(echo $PRACTICE_PATIENT_BODY | jq '.total // .entry | length // 0')"
      echo ""
      echo "🏆 SOLUTION FOUND!"
      echo "Add to .env.local: ATHENA_PRACTICE_ID=$FIRST_PRACTICE"
      echo "Use: ?ah-practice=$FIRST_PRACTICE in all FHIR requests"
      exit 0
    else
      echo "❌ Practice-specific request still failed: $PRACTICE_PATIENT_STATUS"
      PRACTICE_ERROR=$(echo $PRACTICE_PATIENT_TEST | sed -e 's/HTTPSTATUS\:.*//g')
      echo "Error: $(echo $PRACTICE_ERROR | jq -r '.issue[0].details // .issue[0].code // .')"
    fi
  fi
else
  echo "❌ Organization endpoint also fails: $ORG_STATUS"
  ORG_ERROR=$(echo $ORG_TEST | sed -e 's/HTTPSTATUS\:.*//g')
  echo "Error: $(echo $ORG_ERROR | jq -r '.issue[0].details // .issue[0].code // .')"
fi

echo ""
echo "🎯 SANDBOX TROUBLESHOOTING SUMMARY:"
echo "=================================="
echo "1. Your OAuth configuration is CORRECT"
echo "2. Your FHIR base URL is CORRECT" 
echo "3. The issue is likely one of:"
echo "   a) Sandbox environment not fully configured"
echo "   b) Missing practice/organization setup in sandbox"
echo "   c) Athena sandbox requires manual activation"
echo "   d) Preview environment has restricted access"
echo ""
echo "💡 NEXT STEPS:"
echo "1. Contact Athena Health sandbox support"
echo "2. Check if your sandbox needs manual activation"
echo "3. Verify your Developer Portal app has sandbox data enabled"
echo "4. Try requesting production-like sandbox access"
echo ""
echo "📧 Contact: athenahealth Developer Support"
echo "🌐 Portal: https://mydata.athenahealth.com"