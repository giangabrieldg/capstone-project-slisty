//Google Drive service with auto-refresh token
const { google } = require('googleapis');

class GoogleDriveService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );

    // Set initial credentials
    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  
  //Ensure we have a valid access token
   
  async ensureValidAccessToken() {
    try {
      const { token } = await this.oauth2Client.getAccessToken();
      if (!token) {
        await this.oauth2Client.refreshAccessToken();
        console.log('Google Drive token refreshed successfully');
      }
      return true;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Google Drive authentication failed');
    }
  }

  
  //Upload image to Google Drive
   
  async uploadImage(file, folderId = process.env.GOOGLE_DRIVE_FOLDER_ID) {
    try {
      await this.ensureValidAccessToken();

      const fileMetadata = {
        name: `${Date.now()}-${file.originalname}`,
        parents: [folderId],
      };

      const media = {
        mimeType: file.mimetype,
        body: require('stream').Readable.from(file.buffer),
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
      });

      const fileId = response.data.id;

      // Make the file publicly accessible
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Return Google CDN URL
      return `https://lh3.googleusercontent.com/d/${fileId}=s500`;
    } catch (error) {
      console.error('Google Drive upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  
  //Delete file from Google Drive
   
  async deleteFile(fileUrl) {
    try {
      await this.ensureValidAccessToken();
      
      // Extract file ID from URL
      const fileId = this.extractFileId(fileUrl);
      if (!fileId) return;

      await this.drive.files.delete({
        fileId: fileId,
      });
    } catch (error) {
      console.error('Google Drive delete error:', error);
      // Don't throw error for delete operations to avoid breaking main functionality
    }
  }

  
  //Extract file ID from Google Drive URL
  extractFileId(url) {
    if (!url) return null;
    
    // Match patterns like: lh3.googleusercontent.com/d/FILE_ID=s500
    const match = url.match(/\/d\/([^=]+)/);
    return match ? match[1] : null;
  }

  
  //Check if authentication is working
   
  async testConnection() {
    try {
      await this.ensureValidAccessToken();
      const response = await this.drive.files.list({
        pageSize: 1,
        fields: 'files(id, name)',
      });
      return { success: true, files: response.data.files };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const googleDriveService = new GoogleDriveService();

module.exports = googleDriveService;