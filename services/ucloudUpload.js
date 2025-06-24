// UCloud upload service for WeChat Mini Program
const CryptoJS = require('./crypto-js.min.js');
const config = require('../config.js');

// UCloud US3 configuration
const US3_CONFIG = {
  region: config.UCLOUD_REGION || 'cn-wlcb',
  endpoint: config.UCLOUD_ENDPOINT || 'https://xiaoshow.cn-wlcb.ufileos.com',
  bucket: config.UCLOUD_BUCKET || 'xiaoshow',
  host: config.UCLOUD_HOST || 'xiaoshow.cn-wlcb.ufileos.com',
  accessKey: config.UCLOUD_ACCESS_KEY || '4eZCt9AaZ6MGsYvAaZWv64Hnfz40sDxXZ',
  secretKey: config.UCLOUD_SECRET_KEY || 'HGSlexufJmv2GdFAXbG4feFs7Ov993T5k7hkRED9XwDq',
};

// Log configuration on load (hide sensitive data)
console.log('UCloud config loaded:', {
  region: US3_CONFIG.region,
  endpoint: US3_CONFIG.endpoint,
  bucket: US3_CONFIG.bucket,
  host: US3_CONFIG.host,
  hasAccessKey: US3_CONFIG.accessKey !== 'your_access_key',
  hasSecretKey: US3_CONFIG.secretKey !== 'your_secret_key'
});

// Global upload queue to manage concurrent uploads
let activeUploads = 0;
const MAX_CONCURRENT_UPLOADS = 1; // Set to 1 to ensure sequential uploads
const uploadQueue = [];
let globalUploadLock = false;

// Global lock to prevent any concurrent uploads
const acquireGlobalUploadLock = async () => {
  while (globalUploadLock) {
    console.log('Waiting for global upload lock...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  globalUploadLock = true;
  console.log('Global upload lock acquired');
  
  // Extra wait to ensure previous connections are closed
  await new Promise(resolve => setTimeout(resolve, 3000));
};

const releaseGlobalUploadLock = () => {
  globalUploadLock = false;
  console.log('Global upload lock released');
};

const waitForUploadSlot = () => {
  return new Promise((resolve) => {
    const checkSlot = () => {
      if (activeUploads < MAX_CONCURRENT_UPLOADS) {
        activeUploads++;
        resolve();
      } else {
        setTimeout(checkSlot, 100);
      }
    };
    checkSlot();
  });
};

const releaseUploadSlot = () => {
  activeUploads--;
  if (activeUploads < 0) activeUploads = 0;
};

// Generate unique file name
const generateUniqueFileName = (originalName, folder = '') => {
  if (!originalName || typeof originalName !== 'string') {
    console.error('Invalid originalName:', originalName);
    originalName = 'unknown_file.jpg'; // Default fallback
  }
  
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const nameParts = originalName.split('.');
  const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : 'jpg';
  const baseName = `${timestamp}_${randomStr}`;
  const fileName = `${baseName}.${ext}`;
  
  return {
    fileName: folder ? `${folder}/${fileName}` : fileName,
    baseName,
    ext
  };
};

// Generate image file names for compressed and blur versions
const generateImageFileNames = (originalName, uploadFolder = 'uploads', blurFolder = 'blurs') => {
  if (!originalName || typeof originalName !== 'string') {
    console.error('Invalid originalName for image:', originalName);
    originalName = 'image.jpg'; // Default fallback
  }
  
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const baseName = `${timestamp}_${randomStr}`;
  
  return {
    upload: `${uploadFolder}/${baseName}.jpg`,
    blur: `${blurFolder}/${baseName}_blur.jpg`,
    baseName: baseName
  };
};

// Calculate UCloud signature according to documentation
const calculateSignature = (method, publicKey, privateKey, md5, contentType, date, bucketName, fileName) => {
  console.log('Signature calculation inputs:');
  console.log('- method:', method);
  console.log('- publicKey:', publicKey);
  console.log('- privateKey length:', privateKey ? privateKey.length : 'null');
  console.log('- md5:', md5);
  console.log('- contentType:', contentType);
  console.log('- date:', date);
  console.log('- bucketName:', bucketName);
  console.log('- fileName:', fileName);
  
  const CanonicalizedResource = `/${bucketName}/${fileName}`;
  const StringToSign = method + "\n" 
                     + md5 + "\n" 
                     + contentType + "\n" 
                     + date + "\n"
                     + CanonicalizedResource;
                     
  console.log('String to sign:', JSON.stringify(StringToSign));
  
  let Signature = CryptoJS.HmacSHA1(StringToSign, privateKey);
  Signature = CryptoJS.enc.Base64.stringify(Signature);
  const Authorization = "UCloud" + " " + publicKey + ":" + Signature;
  
  console.log('Generated signature:', Signature);
  console.log('Final authorization:', Authorization);
  
  return Authorization;
};

// Compress image using Canvas for better control
const compressImage = async (filePath, options = {}) => {
  console.log('compressImage called with:', filePath, options);
  
  return new Promise((resolve) => {
    if (!filePath) {
      console.error('File path is required for image compression');
      resolve(filePath);
      return;
    }
    
    // First try direct compression
    const quality = Math.floor((options.quality || 0.5) * 100); // Use 50% quality for more compression
    console.log('Trying direct compression with quality:', quality);
    
    wx.compressImage({
      src: filePath,
      quality: quality,
      success: (res) => {
        console.log('Direct compression successful');
        
        // Check compressed file size
        wx.getFileInfo({
          filePath: res.tempFilePath,
          success: (info) => {
            console.log('Compressed file size:', info.size, 'bytes (', (info.size / 1024 / 1024).toFixed(2), 'MB)');
            
            // If still too large, try canvas compression
            if (info.size > 2 * 1024 * 1024) { // If larger than 2MB
              console.log('File still too large, trying canvas compression...');
              compressWithCanvas(filePath, options, resolve);
            } else {
              resolve(res.tempFilePath);
            }
          },
          fail: () => {
            console.log('Could not get file info, using compressed file anyway');
            resolve(res.tempFilePath);
          }
        });
      },
      fail: (error) => {
        console.error('Direct compression failed:', error);
        console.log('Trying canvas compression as fallback...');
        compressWithCanvas(filePath, options, resolve);
      }
    });
  });
};

// Helper function for canvas compression
const compressWithCanvas = (filePath, options, resolve) => {
  console.log('Starting canvas compression...');
  
  wx.getImageInfo({
    src: filePath,
    success: (imageInfo) => {
      console.log('Image info for canvas:', imageInfo);
      
      // Calculate new dimensions
      const maxSize = options.maxWidthOrHeight || 1920;
      let newWidth = imageInfo.width;
      let newHeight = imageInfo.height;
      
      if (imageInfo.width > maxSize || imageInfo.height > maxSize) {
        const ratio = Math.min(maxSize / imageInfo.width, maxSize / imageInfo.height);
        newWidth = Math.floor(imageInfo.width * ratio);
        newHeight = Math.floor(imageInfo.height * ratio);
      }
      
      console.log(`Canvas dimensions: ${newWidth}x${newHeight}`);
      
      // Use the pre-existing canvas
      const ctx = wx.createCanvasContext('compressCanvas');
      
      // Clear canvas
      ctx.clearRect(0, 0, newWidth, newHeight);
      
      // Draw image
      ctx.drawImage(filePath, 0, 0, newWidth, newHeight);
      
      // Draw and export
      ctx.draw(false, () => {
        setTimeout(() => { // Add delay to ensure draw is complete
          wx.canvasToTempFilePath({
            canvasId: 'compressCanvas',
            x: 0,
            y: 0,
            width: newWidth,
            height: newHeight,
            destWidth: newWidth,
            destHeight: newHeight,
            fileType: 'jpg',
            quality: options.quality || 0.5,
            success: (res) => {
              console.log('Canvas export successful');
              
              // Verify the result
              wx.getFileInfo({
                filePath: res.tempFilePath,
                success: (info) => {
                  console.log('Canvas compressed size:', info.size, 'bytes (', (info.size / 1024 / 1024).toFixed(2), 'MB)');
                  resolve(res.tempFilePath);
                },
                fail: () => {
                  resolve(res.tempFilePath);
                }
              });
            },
            fail: (error) => {
              console.error('Canvas export failed:', error);
              console.log('Using original file as last resort');
              resolve(filePath);
            }
          });
        }, 100);
      });
    },
    fail: (error) => {
      console.error('Failed to get image info for canvas:', error);
      console.log('Using original file');
      resolve(filePath);
    }
  });
};

// Create blur image using canvas API with stronger blur effect
const createBlurImage = async (filePath) => {
  return new Promise((resolve) => {
    if (!filePath) {
      console.error('File path is required for blur image creation');
      resolve(filePath);
      return;
    }
    
    console.log('Creating blur image from:', filePath);
    
    // Get image info first
    wx.getImageInfo({
      src: filePath,
      success: (imageInfo) => {
        console.log('Blur image info:', imageInfo);
        
        // Use very small size for blur effect (much smaller than before)
        const maxSize = 50; // Very small for extreme blur
        const ratio = Math.min(maxSize / imageInfo.width, maxSize / imageInfo.height);
        const canvasWidth = Math.floor(imageInfo.width * ratio);
        const canvasHeight = Math.floor(imageInfo.height * ratio);
        
        console.log(`Blur canvas size: ${canvasWidth}x${canvasHeight}`);
        
        // Create canvas context
        const ctx = wx.createCanvasContext('blurCanvas');
        
        // Clear canvas first
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // Set canvas size
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Draw base image very small
        ctx.drawImage(filePath, 0, 0, canvasWidth, canvasHeight);
        
        // Apply multiple blur passes with increasing offsets
        ctx.globalAlpha = 0.5;
        
        // First pass - small blur
        for (let i = 0; i < 3; i++) {
          ctx.drawImage(filePath, -1, -1, canvasWidth + 2, canvasHeight + 2);
          ctx.drawImage(filePath, 1, -1, canvasWidth + 2, canvasHeight + 2);
          ctx.drawImage(filePath, -1, 1, canvasWidth + 2, canvasHeight + 2);
          ctx.drawImage(filePath, 1, 1, canvasWidth + 2, canvasHeight + 2);
        }
        
        // Second pass - medium blur
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 5; i++) {
          const offset = i + 2;
          ctx.drawImage(filePath, -offset, -offset, canvasWidth + offset*2, canvasHeight + offset*2);
          ctx.drawImage(filePath, offset, -offset, canvasWidth + offset*2, canvasHeight + offset*2);
          ctx.drawImage(filePath, -offset, offset, canvasWidth + offset*2, canvasHeight + offset*2);
          ctx.drawImage(filePath, offset, offset, canvasWidth + offset*2, canvasHeight + offset*2);
        }
        
        // Third pass - large blur
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 8; i++) {
          const offset = i * 2 + 5;
          ctx.drawImage(filePath, -offset, 0, canvasWidth + offset*2, canvasHeight);
          ctx.drawImage(filePath, offset, 0, canvasWidth + offset*2, canvasHeight);
          ctx.drawImage(filePath, 0, -offset, canvasWidth, canvasHeight + offset*2);
          ctx.drawImage(filePath, 0, offset, canvasWidth, canvasHeight + offset*2);
        }
        
        // Draw canvas
        ctx.draw(false, () => {
          setTimeout(() => {
            // Export with very low quality
            wx.canvasToTempFilePath({
              canvasId: 'blurCanvas',
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              destWidth: canvasWidth * 2, // Scale up slightly for better effect
              destHeight: canvasHeight * 2,
              fileType: 'jpg',
              quality: 0.05, // Extremely low quality for maximum blur effect
              success: (res) => {
                console.log('Blur image created successfully:', res.tempFilePath);
                
                // Apply additional compression for even smaller file
                wx.compressImage({
                  src: res.tempFilePath,
                  quality: 5, // 5% quality
                  success: (compressRes) => {
                    console.log('Blur image double compressed');
                    resolve(compressRes.tempFilePath);
                  },
                  fail: () => {
                    console.log('Double compression failed, using single blur');
                    resolve(res.tempFilePath);
                  }
                });
              },
              fail: (error) => {
                console.error('Canvas blur export failed:', error);
                // Fallback to extreme compression
                wx.compressImage({
                  src: filePath,
                  quality: 5, // 5% quality
                  success: (compressRes) => {
                    console.log('Fallback blur compression successful');
                    resolve(compressRes.tempFilePath);
                  },
                  fail: () => {
                    console.log('All blur attempts failed');
                    resolve(filePath);
                  }
                });
              }
            });
          }, 100);
        });
      },
      fail: (error) => {
        console.error('Failed to get image info for blur:', error);
        // Fallback to extreme compression
        wx.compressImage({
          src: filePath,
          quality: 5,
          success: (res) => {
            console.log('Direct blur compression successful');
            resolve(res.tempFilePath);
          },
          fail: () => {
            resolve(filePath);
          }
        });
      }
    });
  });
};


// Generate video thumbnail using video context
const generateVideoThumbnail = async (videoPath) => {
  return new Promise((resolve) => {
    if (!videoPath) {
      console.error('Video path is required for thumbnail generation');
      resolve(null);
      return;
    }
    
    console.log('Generating thumbnail for video:', videoPath);
    
    // Get video info first
    wx.getVideoInfo({
      src: videoPath,
      success: (videoInfo) => {
        console.log('Video info:', videoInfo);
        
        // WeChat doesn't directly support frame capture, so we'll use canvas approach
        // Create a temporary video element and draw it to canvas
        const canvasId = 'thumbnailCanvas';
        const ctx = wx.createCanvasContext(canvasId);
        
        // Calculate thumbnail dimensions (16:9 aspect ratio)
        const maxWidth = 320;
        const maxHeight = 180;
        let width = videoInfo.width;
        let height = videoInfo.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        console.log(`Thumbnail dimensions: ${width}x${height}`);
        
        // Since we can't directly capture video frames in WeChat Mini Program,
        // we'll create a placeholder thumbnail with video info
        ctx.setFillStyle('#000000');
        ctx.fillRect(0, 0, width, height);
        
        // Add play button icon
        ctx.setFillStyle('#FFFFFF');
        ctx.setGlobalAlpha(0.8);
        const centerX = width / 2;
        const centerY = height / 2;
        const buttonSize = Math.min(width, height) * 0.2;
        
        // Draw play triangle
        ctx.beginPath();
        ctx.moveTo(centerX - buttonSize/2, centerY - buttonSize/2);
        ctx.lineTo(centerX - buttonSize/2, centerY + buttonSize/2);
        ctx.lineTo(centerX + buttonSize/2, centerY);
        ctx.closePath();
        ctx.fill();
        
        // Add duration text
        ctx.setFillStyle('#FFFFFF');
        ctx.setFontSize(12);
        ctx.setGlobalAlpha(1);
        const duration = Math.floor(videoInfo.duration);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        ctx.fillText(durationText, 10, height - 10);
        
        ctx.draw(false, () => {
          setTimeout(() => {
            wx.canvasToTempFilePath({
              canvasId: canvasId,
              x: 0,
              y: 0,
              width: width,
              height: height,
              destWidth: width,
              destHeight: height,
              fileType: 'jpg',
              quality: 0.8,
              success: (res) => {
                console.log('Thumbnail created successfully:', res.tempFilePath);
                resolve(res.tempFilePath);
              },
              fail: (error) => {
                console.error('Failed to create thumbnail:', error);
                resolve(null);
              }
            });
          }, 100);
        });
      },
      fail: (error) => {
        console.error('Failed to get video info:', error);
        resolve(null);
      }
    });
  });
};

// Upload file to UCloud with retry logic
const uploadToUCloud = async (filePath, fileName, onProgress = null, maxRetries = 2) => {
  let attempt = 0;
  
  while (attempt <= maxRetries) {
    try {
      const result = await uploadFileToUCloud(filePath, fileName, onProgress);
      return result;
    } catch (error) {
      attempt++;
      if (attempt > maxRetries) {
        throw error;
      }
      console.log(`Upload attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
    }
  }
};

// Direct UCloud upload implementation with signature
const uploadFileToUCloud = async (filePath, fileName, onProgress) => {
  // Acquire global lock before any upload
  console.log(`Acquiring global lock for: ${fileName}`);
  await acquireGlobalUploadLock();
  
  // Wait for available upload slot
  console.log(`Waiting for upload slot for: ${fileName}`);
  await waitForUploadSlot();
  console.log(`Got upload slot for: ${fileName}, active uploads: ${activeUploads}`);
  
  return new Promise((resolve, reject) => {
    // Validate inputs
    if (!filePath) {
      releaseUploadSlot();
      releaseGlobalUploadLock();
      reject(new Error('File path is required'));
      return;
    }
    
    if (!fileName || typeof fileName !== 'string') {
      releaseUploadSlot();
      releaseGlobalUploadLock();
      reject(new Error('File name is required and must be a string'));
      return;
    }
    
    console.log('Starting direct UCloud upload:', fileName);
    console.log('File path:', filePath);
    
    wx.getFileInfo({
      filePath: filePath,
      success: (fileInfo) => {
        const fileSize = fileInfo.size;
        const contentType = getContentType(fileName);
        
        console.log('File size:', fileSize);
        console.log('Content type:', contentType);
        
        try {
          // Read file as binary data
          const fileData = wx.getFileSystemManager().readFileSync(filePath);
          
          // Generate UCloud signature for PUT method
          const authorization = calculateSignature('PUT', US3_CONFIG.accessKey, US3_CONFIG.secretKey, '', contentType, '', US3_CONFIG.bucket, fileName);
          const uploadUrl = `https://${US3_CONFIG.bucket}.${US3_CONFIG.host}/${fileName}`;
          
          console.log('Upload URL:', uploadUrl);
          console.log('Authorization:', authorization);
          console.log('Using PUT method with direct data');
          
          // Use wx.request with PUT method
          wx.request({
            url: uploadUrl,
            method: 'PUT',
            header: {
              'Authorization': authorization,
              'Content-Type': contentType,
              'Content-Length': fileSize.toString()
            },
            data: fileData,
            success: (res) => {
              releaseUploadSlot();
              releaseGlobalUploadLock();
              console.log('UCloud upload response:', res);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const finalUrl = `https://${US3_CONFIG.bucket}.${US3_CONFIG.host}/${fileName}`;
                resolve({
                  url: finalUrl,
                  size: fileSize,
                  fileName: fileName
                });
              } else {
                console.error('UCloud upload failed:', res.statusCode, res.errMsg);
                console.log('Response data:', res.data);
                reject(new Error(`Upload failed: ${res.errMsg || res.data} (${res.statusCode})`));
              }
            },
            fail: (error) => {
              releaseUploadSlot();
              releaseGlobalUploadLock();
              console.error('UCloud upload request failed:', error);
              reject(new Error(`Upload request failed: ${error.errMsg}`));
            }
          });
          
          // Note: wx.request doesn't support progress monitoring
          // We'll simulate progress for better UX
          if (onProgress) {
            let progress = 0;
            const progressInterval = setInterval(() => {
              progress = Math.min(progress + 10, 90);
              onProgress(progress);
              if (progress >= 90) {
                clearInterval(progressInterval);
                // Set to 100% when response is received
                setTimeout(() => onProgress(100), 500);
              }
            }, 100);
          }
        } catch (error) {
          releaseUploadSlot();
          releaseGlobalUploadLock();
          console.error('File read or signature generation failed:', error);
          reject(new Error(`Upload preparation failed: ${error.message}`));
        }
      },
      fail: (error) => {
        releaseUploadSlot();
        releaseGlobalUploadLock();
        console.error('Get file info failed:', error);
        reject(error);
      }
    });
  });
};


// Get content type from file extension
const getContentType = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase();
  const types = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp4: 'video/mp4',
    avi: 'video/avi',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav'
  };
  return types[ext] || 'application/octet-stream';
};

// Main upload functions
const uploadImage = async (filePath, onProgress = null, uploadFolder = 'uploads', blurFolder = 'blurs') => {
  try {
    if (!filePath) {
      throw new Error('File path is required for image upload');
    }
    
    const originalName = filePath.split('/').pop() || 'image.jpg';
    console.log('Processing image:', originalName);
    
    const fileNames = generateImageFileNames(originalName, uploadFolder, blurFolder);
    console.log('Generated file names:', fileNames);
    
    let uploadedCount = 0;
    const totalUploads = 2; // compressed + blur
    
    const progressCallback = (percent) => {
      if (onProgress) {
        const totalProgress = Math.round(((uploadedCount * 100) + percent) / totalUploads);
        onProgress(totalProgress);
      }
    };
    
    // Compress image before upload
    console.log('Starting image compression...');
    const compressedPath = await compressImage(filePath, {
      quality: 0.5,  // 50% quality for better compression
      maxWidthOrHeight: 1920
    });
    console.log('Image compression complete, path:', compressedPath);
    
    // Create blur image
    console.log('Starting blur image creation...');
    const blurPath = await createBlurImage(filePath);
    console.log('Blur image created successfully:', blurPath);
    
    // Upload compressed version
    console.log('Starting upload of compressed image with name:', fileNames.upload);
    let uploadResult, blurResult;
    
    try {
      uploadResult = await uploadToUCloud(compressedPath, fileNames.upload, progressCallback);
      uploadedCount++;
      console.log('Compressed image uploaded successfully:', uploadResult);
      
      // Add delay between uploads to avoid connection limit
      console.log('Waiting 1000ms before uploading blur version...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (uploadError) {
      console.error('Compressed image upload failed:', uploadError);
      throw uploadError;
    }
    
    // Upload blur image
    console.log('Starting upload of blur image with name:', fileNames.blur);
    try {
      blurResult = await uploadToUCloud(blurPath, fileNames.blur, progressCallback);
      uploadedCount++;
      console.log('Blur image uploaded successfully:', blurResult);
    } catch (blurError) {
      console.error('Blur image upload failed:', blurError);
      // Use compressed image URL as fallback
      blurResult = { url: uploadResult.url, size: 0, fileName: fileNames.blur };
    }
    
    return {
      uploadUrl: uploadResult.url,
      blurUrl: blurResult.url,
      baseName: fileNames.baseName,
      originalName: originalName,
      uploadSize: uploadResult.size,
      blurSize: blurResult.size,
      folders: {
        upload: uploadFolder,
        blur: blurFolder
      }
    };
  } catch (error) {
    console.error('Image upload failed:', error);
    throw error;
  }
};

const uploadVideo = async (filePath, onProgress = null, videoFolder = 'videos', thumbnailFolder = 'thumbnails') => {
  try {
    if (!filePath) {
      throw new Error('File path is required for video upload');
    }
    
    const originalName = filePath.split('/').pop() || 'video.mp4';
    console.log('Processing video:', originalName);
    
    const { fileName } = generateUniqueFileName(originalName, videoFolder);
    console.log('Generated video file name:', fileName);
    
    let uploadedCount = 0;
    const progressCallback = (percent) => {
      if (onProgress) {
        // If we have thumbnail, it's 2 uploads, otherwise 1
        const totalUploads = 2; // Always assume we'll try thumbnail
        const totalProgress = Math.round(((uploadedCount * 100) + percent) / totalUploads);
        onProgress(totalProgress);
      }
    };
    
    // Generate and upload thumbnail
    let thumbnailUrl = null;
    console.log('Generating video thumbnail...');
    try {
      const thumbnailPath = await generateVideoThumbnail(filePath);
      if (thumbnailPath) {
        const thumbnailName = `${thumbnailFolder}/${fileName.split('/').pop().replace(/\.[^.]+$/, '_thumb.jpg')}`;
        console.log('Starting upload of video thumbnail with name:', thumbnailName);
        const thumbnailResult = await uploadToUCloud(thumbnailPath, thumbnailName, progressCallback);
        thumbnailUrl = thumbnailResult.url;
        uploadedCount++;
        console.log('Video thumbnail uploaded successfully:', thumbnailUrl);
        
        // Add delay between uploads
        console.log('Waiting 1000ms before uploading video...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log('No thumbnail generated, skipping thumbnail upload');
        uploadedCount++;
      }
    } catch (error) {
      console.error('Thumbnail generation/upload failed:', error);
      uploadedCount++;
    }
    
    // Upload video
    console.log('Starting upload of video with name:', fileName);
    const result = await uploadToUCloud(filePath, fileName, progressCallback);
    uploadedCount++;
    console.log('Video uploaded successfully');
    
    return {
      videoUrl: result.url,
      thumbnailUrl: thumbnailUrl,
      fileName: fileName,
      originalName: originalName,
      videoSize: result.size,
      thumbnailSize: thumbnailUrl ? 0 : 0, // We don't have thumbnail size info
      folders: {
        video: videoFolder,
        thumbnail: thumbnailFolder
      }
    };
  } catch (error) {
    console.error('Video upload failed:', error);
    throw error;
  }
};

const uploadAudio = async (filePath, onProgress = null, audioFolder = 'audios') => {
  try {
    if (!filePath) {
      throw new Error('File path is required for audio upload');
    }
    
    console.log('Starting audio upload:', filePath);
    const originalName = filePath.split('/').pop() || 'audio.mp3';
    console.log('Processing audio:', originalName);
    
    const { fileName } = generateUniqueFileName(originalName, audioFolder);
    console.log('Generated audio file name:', fileName);
    
    console.log('Starting upload of audio with name:', fileName);
    const result = await uploadToUCloud(filePath, fileName, onProgress);
    console.log('Audio uploaded successfully');
    
    return {
      audioUrl: result.url,
      fileName: fileName,
      originalName: originalName,
      audioSize: result.size,
      folder: audioFolder
    };
  } catch (error) {
    console.error('Audio upload failed:', error);
    throw error;
  }
};

const uploadMedia = async (file, onProgress = null, folders = {}) => {
  console.log('uploadMedia called with file:', file);
  
  // Validate file input
  if (!file) {
    throw new Error('File parameter is required');
  }
  
  const filePath = file.tempFilePath || file.path || file.url;
  if (!filePath) {
    throw new Error('File path is required');
  }
  
  // Generate safe file name with proper fallbacks
  let fileName = file.name || file.tempFilePath?.split('/').pop() || file.path?.split('/').pop() || file.url?.split('/').pop();
  if (!fileName || typeof fileName !== 'string') {
    // Generate a default name based on file type detection
    const timestamp = Date.now();
    fileName = `file_${timestamp}.jpg`; // Default to jpg
    console.warn('No valid file name found, using default:', fileName);
  }
  
  console.log('File path:', filePath);
  console.log('File name:', fileName);
  
  // File type detection with better validation
  const isImage = /\.(jpg|jpeg|png|gif|bmp|heic|webp)$/i.test(fileName);
  const isVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(fileName);
  const isAudio = /\.(mp3|wav|aac|m4a|flac|ogg|wma)$/i.test(fileName);
  
  console.log('File type detection - Image:', isImage, 'Video:', isVideo, 'Audio:', isAudio);
  
  // If we can't detect file type from name, try to infer from file object
  if (!isImage && !isVideo && !isAudio) {
    if (file.type) {
      if (file.type.startsWith('image/')) {
        fileName = fileName.replace(/\.[^.]*$/, '.jpg'); // Change extension to jpg
      } else if (file.type.startsWith('video/')) {
        fileName = fileName.replace(/\.[^.]*$/, '.mp4'); // Change extension to mp4
      } else if (file.type.startsWith('audio/')) {
        fileName = fileName.replace(/\.[^.]*$/, '.mp3'); // Change extension to mp3
      }
    }
  }
  
  // Re-check file type after potential name correction
  const finalIsImage = /\.(jpg|jpeg|png|gif|bmp|heic|webp)$/i.test(fileName);
  const finalIsVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(fileName);
  const finalIsAudio = /\.(mp3|wav|aac|m4a|flac|ogg|wma)$/i.test(fileName);
  
  // Folder configuration with defaults
  const folderConfig = {
    upload: folders.upload || 'uploads',
    blur: folders.blur || 'blurs',
    video: folders.video || 'videos',
    thumbnail: folders.thumbnail || 'thumbnails',
    audio: folders.audio || 'audios'
  };
  
  try {
    let result;
    if (finalIsImage) {
      result = await uploadImage(filePath, onProgress, folderConfig.upload, folderConfig.blur);
    } else if (finalIsVideo) {
      result = await uploadVideo(filePath, onProgress, folderConfig.video, folderConfig.thumbnail);
    } else if (finalIsAudio) {
      result = await uploadAudio(filePath, onProgress, folderConfig.audio);
    } else {
      throw new Error('Unsupported file type: ' + fileName);
    }
    
    // Validate result
    if (!result) {
      throw new Error('Upload result is empty');
    }
    
    return result;
  } catch (error) {
    console.error(`Error in uploadMedia for ${fileName}:`, error);
    throw error;
  }
};

// Multiple media upload with sequential processing to avoid connection limit
const uploadMultipleMedia = async (files, onProgress = null, folders = {}) => {
  const results = [];
  const totalFiles = files.length;
  
  console.log(`Starting sequential upload of ${totalFiles} files`);
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    console.log(`Processing file ${i + 1}/${totalFiles}: ${file.name || 'unknown'}`);
    
    const fileProgressCallback = (percent) => {
      if (onProgress) {
        const totalProgress = Math.round(((i * 100) + percent) / totalFiles);
        onProgress(totalProgress, i, file.name || 'file');
      }
    };
    
    try {
      // Add delay between files to avoid connection limit
      if (i > 0) {
        console.log('Waiting 3000ms before next file upload...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      const result = await uploadMedia(file, fileProgressCallback, folders);
      results.push({ success: true, file: file.name || 'file', data: result });
      
      console.log(`File ${i + 1}/${totalFiles} uploaded successfully`);
    } catch (error) {
      console.error(`File upload failed (${file.name || 'file'}):`, error);
      results.push({ success: false, file: file.name || 'file', error: error.message });
    }
  }
  
  console.log('All uploads completed:', results);
  return results;
};

// Export functions
module.exports = {
  uploadImage,
  uploadVideo,
  uploadAudio,
  uploadMedia,
  uploadMultipleMedia,
  US3_CONFIG,
  compressImage,
  createBlurImage,
  generateVideoThumbnail
};