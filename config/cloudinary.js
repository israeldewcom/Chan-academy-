const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const logger = require('./logger');

class CloudinaryService {
  constructor() {
    this.configure();
  }

  configure() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
      timeout: 60000,
    });
    logger.info('☁️  Cloudinary configured');
  }

  getStorage(folder = 'changex') {
    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'changex'}/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'pdf'],
        transformation: [
          { quality: 'auto:good', fetch_format: 'auto' }
        ],
      },
    });
  }

  getAvatarStorage() {
    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'changex'}/avatars`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good' }
        ],
      },
    });
  }

  getThumbnailStorage() {
    return new CloudinaryStorage({
      cloudinary,
      params: {
        folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'changex'}/thumbnails`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 800, height: 450, crop: 'fill', quality: 'auto:good' }
        ],
      },
    });
  }

  async uploadImage(file, options = {}) {
    try {
      const defaultOptions = {
        folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'changex'}/images`,
        quality: 'auto:good',
        fetch_format: 'auto',
        crop: 'limit',
        width: 1920,
        height: 1080,
        resource_type: 'image',
        ...options,
      };

      const result = await cloudinary.uploader.upload(file, defaultOptions);

      logger.info(`📸 Image uploaded: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        thumbnailUrl: cloudinary.url(result.public_id, {
          width: 400,
          height: 300,
          crop: 'fill',
          quality: 'auto:good',
        }),
      };
    } catch (error) {
      logger.error('Cloudinary image upload error:', error);
      throw error;
    }
  }

  async uploadVideo(file, options = {}) {
    try {
      const defaultOptions = {
        folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'changex'}/videos`,
        resource_type: 'video',
        quality: 'auto:good',
        fetch_format: 'auto',
        eager: [
          { streaming_profile: 'full_hd', format: 'm3u8' },
          { streaming_profile: 'hd', format: 'mp4' },
          { format: 'jpg', effect: 'viusage_1000', width: 400, crop: 'fill' },
        ],
        eager_async: true,
        eager_notification_url: `${process.env.API_URL}/api/v1/webhooks/cloudinary/video-ready`,
        ...options,
      };

      const result = await cloudinary.uploader.upload(file, defaultOptions);

      logger.info(`🎥 Video uploaded: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        duration: result.duration,
        format: result.format,
        size: result.bytes,
        streamingUrl: result.eager?.[0]?.secure_url,
        downloadUrl: result.eager?.[1]?.secure_url,
        thumbnailUrl: result.eager?.[2]?.secure_url,
      };
    } catch (error) {
      logger.error('Cloudinary video upload error:', error);
      throw error;
    }
  }

  async uploadPdf(file, options = {}) {
    try {
      const defaultOptions = {
        folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER || 'changex'}/documents`,
        resource_type: 'raw',
        ...options,
      };

      const result = await cloudinary.uploader.upload(file, defaultOptions);

      logger.info(`📄 PDF uploaded: ${result.public_id}`);

      return {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
      };
    } catch (error) {
      logger.error('Cloudinary PDF upload error:', error);
      throw error;
    }
  }

  async deleteFile(publicId, resourceType = 'image') {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      });

      logger.info(`🗑️  File deleted: ${publicId}`, { result });

      return result;
    } catch (error) {
      logger.error('Cloudinary delete error:', error);
      throw error;
    }
  }

  async deleteFolder(folder) {
    try {
      const result = await cloudinary.api.delete_folder(folder);
      logger.info(`📁 Folder deleted: ${folder}`);
      return result;
    } catch (error) {
      logger.error('Cloudinary delete folder error:', error);
      throw error;
    }
  }

  async generateUrl(publicId, transformations = {}) {
    try {
      const url = cloudinary.url(publicId, {
        secure: true,
        sign_url: true,
        quality: 'auto:good',
        fetch_format: 'auto',
        ...transformations,
      });
      return url;
    } catch (error) {
      logger.error('Cloudinary URL generation error:', error);
      throw error;
    }
  }

  async generateSignedUrl(publicId, expiresAt) {
    try {
      const url = cloudinary.url(publicId, {
        secure: true,
        sign_url: true,
        type: 'authenticated',
        expires_at: expiresAt,
      });
      return url;
    } catch (error) {
      logger.error('Cloudinary signed URL generation error:', error);
      throw error;
    }
  }

  async getFileInfo(publicId) {
    try {
      const result = await cloudinary.api.resource(publicId, {
        colors: true,
        image_metadata: true,
        media_metadata: true,
      });
      return result;
    } catch (error) {
      logger.error('Cloudinary get file info error:', error);
      throw error;
    }
  }

  async listFiles(folder, maxResults = 100) {
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: maxResults,
      });
      return result.resources;
    } catch (error) {
      logger.error('Cloudinary list files error:', error);
      throw error;
    }
  }

  async searchFiles(query) {
    try {
      const result = await cloudinary.search
        .expression(query)
        .sort_by('created_at', 'desc')
        .max_results(50)
        .execute();
      return result.resources;
    } catch (error) {
      logger.error('Cloudinary search error:', error);
      throw error;
    }
  }

  async getUsage() {
    try {
      const result = await cloudinary.api.usage();
      return result;
    } catch (error) {
      logger.error('Cloudinary usage error:', error);
      throw error;
    }
  }

  getInstance() {
    return cloudinary;
  }
}

const cloudinaryService = new CloudinaryService();
module.exports = cloudinaryService;
