// test-apis.js - UPDATED
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

    // Test Gmail API - WITHOUT profile access
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Test Gmail by creating a draft (uses gmail.compose scope)
    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: Buffer.from(
            `To: test@example.com\r\n` +
            `Subject: Test Email from Ordering System\r\n` +
            `\r\n` +
            `This is a test email to verify Gmail API is working.`
          ).toString('base64')
        }
      }
    });
    
    console.log('✅ Gmail API: WORKING');
    console.log('📧 Draft created successfully - Email sending ready!');

    // Delete the test draft to clean up
    await gmail.users.drafts.delete({
      userId: 'me',
      id: draft.data.id
    });
    console.log('🧹 Test draft deleted');

  } catch (error) {
    if (error.code === 403) {
      console.log('❌ Scope missing:', error.message);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

testAPIs();