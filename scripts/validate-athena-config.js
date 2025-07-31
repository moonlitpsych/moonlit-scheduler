#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const requiredEnvVars = [
  'ATHENA_CLIENT_ID',
  'ATHENA_CLIENT_SECRET',
  'ATHENA_BASE_URL',
  'ATHENA_TOKEN_URL'
];

console.log('🔍 Validating Athena Health configuration...\n');

let isValid = true;

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  
  if (!value) {
    console.log(`❌ ${varName}: Missing`);
    isValid = false;
  } else if (value.includes('your_') || value.includes('placeholder') || value.includes('here')) {
    console.log(`❌ ${varName}: Contains placeholder text`);
    isValid = false;
  } else {
    console.log(`✅ ${varName}: Configured (${value.substring(0, 15)}...)`);
  }
});

if (isValid) {
  console.log('\n🎉 Athena Health configuration is valid!');
  console.log('Ready to test API connection.');
} else {
  console.log('\n⚠️  Please check your .env.local file.');
}

process.exit(isValid ? 0 : 1);
