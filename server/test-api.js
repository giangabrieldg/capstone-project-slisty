// test-apis.js
const { google } = require('googleapis');
require('dotenv').config();

async function testAPIs() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  try {
    // Test Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const driveResponse = await drive.files.list({ pageSize: 1 });
    console.log('✅ Google Drive API: WORKING');

    // Test Gmail API  
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const gmailResponse = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail API: WORKING');
    console.log('Email address:', gmailResponse.data.emailAddress);

  } catch (error) {
    if (error.code === 403) {
      console.log('❌ API not enabled or scope missing:', error.message);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testAPIs();