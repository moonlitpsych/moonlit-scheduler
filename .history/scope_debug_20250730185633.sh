#!/bin/bash

# Athena Scope Debug Script
# This will test individual scopes to see which ones actually work

source .env.local

echo "🔍 Debugging Athena OAuth Scopes"
echo "================================"

# Test individual scopes that you mentioned were working
SCOPES=("system/Patient.r" "system/Practitioner.r" "system/Encounter.r" "system/Organization.r")

for SCOPE in "${SCOPES[@]}"; do
  echo ""
  echo "🧪 Testing scope: $SCOPE"
  
  # Get token with single scope
  TOKEN_RESPONSE=$(curl -s -X POST "$ATHENA_TOKEN_URL" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "Authorization: Basic $(echo -n "$ATHENA_CLIENT_ID:$ATHENA_CLIENT_SECRET" | base64)" \
    -d "grant_type=client_credentials&scope=$SCOPE")
  
  echo "Token response: $TOKEN_RESPONSE"
  
  ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.access_token')
  TOKEN_SCOPE=$(echo $TOKEN_RESPONSE | jq -r '.scope')
  
  if [ "$ACCESS_TOKEN" = "null" ]; then
    echo "❌ Failed to get token for scope: $SCOPE"
    echo "Error: $(echo $TOKEN_RESPONSE | jq -r '.error_description // .error')"
    continue
  fi
  
  echo "✅ Got token for scope: $SCOPE"
  echo "   Granted scope: $TOKEN_SCOPE"
  
  # Test the corresponding FHIR endpoint WITHOUT practice context first
  case $SCOPE in
    "system/Patient.r")
      ENDPOINT="/fhir/r4/Patient"
      ;;
    "system/Practitioner.r")
      ENDPOINT="/fhir/r4/Practitioner"
      ;;
    "system/Encounter.r")
      ENDPOINT="/fhir/r4/Encounter"
      ;;
    "system/Organization.r")
      ENDPOINT="/fhir/r4/Organization"
      ;;
  esac
  
  echo "   Testing endpoint: $ENDPOINT"
  
  RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Accept: application/fhir+json" \
    "$ATHENA_BASE_URL$ENDPOINT")
  
  HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
  BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
  
  echo "   HTTP Status: $HTTP_STATUS"
  
  if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "   ✅ SUCCESS - No practice context needed!"
    echo "   Data: $(echo $BODY | jq '.total // .entry | length // "No count available"')"
  elif [ "$HTTP_STATUS" -eq 403 ]; then
    ERROR_MSG=$(echo $BODY | jq -r '.issue[0].details.text // .issue[0].details // .error_description // .')
    if [[ $ERROR_MSG == *"practice"* ]]; then
      echo "   ⚠️  Need practice context (as expected)"
      echo "   Error: $ERROR_MSG"
      
      # Now test with practice context
      echo "   Testing with ah-practice=demo..."
      PRACTICE_RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Accept: application/fhir+json" \
        "$ATHENA_BASE_URL$ENDPOINT?ah-practice=demo")
      
      PRACTICE_STATUS=$(echo $PRACTICE_RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
      PRACTICE_BODY=$(echo $PRACTICE_RESPONSE | sed -e 's/HTTPSTATUS\:.*//g')
      
      if [ "$PRACTICE_STATUS" -eq 200 ]; then
        echo "   ✅ SUCCESS with practice context!"
        echo "   Data: $(echo $PRACTICE_BODY | jq '.total // .entry | length // "No count available"')"
      else
        echo "   ❌ Still failed with practice context"
        echo "   Error: $(echo $PRACTICE_BODY | jq -r '.issue[0].details.text // .issue[0].details // .')"
      fi
    else
      echo "   ❌ Failed with scope error"
      echo "   Error: $ERROR_MSG"
    fi
  else
    echo "   ❌ Unexpected status: $HTTP_STATUS"
    echo "   Error: $(echo $BODY | jq -r '.issue[0].details.text // .error // .')"
  fi
  
  echo "   ----------------------------------------"
done

echo ""
echo "🎯 Summary:"
echo "- Check which individual scopes work"
echo "- Look for the practice context error vs scope errors"  
echo "- If scopes work individually, the issue is multi-scope requests"
echo "- If no scopes work, check your Athena Developer Portal configuration"