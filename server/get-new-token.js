require('dotenv').config();
const { google } = require('googleapis');

// OAuth2 client - USE CORRECT REDIRECT URI
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback' // ← FIXED
);

// Add the missing Gmail scope
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose'
];

async function getNewToken() {
  console.log('🔐 Google OAuth Token Generator');
  console.log('================================\n');

  // Generate the auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: true
  });

  console.log('1. Visit this URL in your browser:');
  console.log(`\n   ${authUrl}\n`);
  
  console.log('2. After approving, you will be redirected to:');
  console.log('   http://localhost:3000/auth/google/callback?code=4/0A...');
  console.log('\n3. Copy the code parameter from that URL');
  console.log('\n4. Run this command:');
  console.log('   node scripts/exchange-code.js YOUR_CODE_HERE');
}

// Check if code is provided as argument
if (process.argv[2]) {
  const code = process.argv[2];
  require('./exchange-code').exchangeCode(code);
} else {
  getNewToken();
}