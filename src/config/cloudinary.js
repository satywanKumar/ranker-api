import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a buffer/file to Cloudinary
 * @param {Buffer} fileBuffer 
 * @param {string} folder 
 * @returns {Promise<object>} Cloudinary upload result
 */
export const uploadToCloudinary = (fileBuffer, folder, resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `coaching_platform/${folder}`,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete a file from Cloudinary by its URL
 * @param {string} url 
 * @param {string} resourceType 'image' | 'raw' | 'video'
 * @returns {Promise<object>} Cloudinary destroy result
 */
export const deleteFromCloudinary = async (url, resourceType = 'auto') => {
  if (!url || typeof url !== 'string') return;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return;

    const pathWithVersion = parts[1];
    const pathParts = pathWithVersion.split('/');
    
    // Check if the first segment is a version string (e.g. v12345678)
    if (pathParts[0].startsWith('v')) {
      pathParts.shift();
    }

    const fullPath = pathParts.join('/');
    
    // Cloudinary requires the extension in the public_id for raw files (like PDFs).
    // For images, the extension must be stripped.
    let publicId = fullPath;
    if (resourceType !== 'raw') {
      const lastDot = fullPath.lastIndexOf('.');
      if (lastDot > -1) {
        publicId = fullPath.substring(0, lastDot);
      }
    }

    console.log(`[Cloudinary] Deleting asset: ${publicId} (type: ${resourceType})`);
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log('[Cloudinary] Deleting result:', result);
    return result;
  } catch (error) {
    console.error('[Cloudinary] Deleting failed:', error);
  }
};

export default cloudinary;
