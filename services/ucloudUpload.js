const CryptoJS = require('./crypto-js.min.js');
const config = require('../config.js');
const US3_CONFIG = {
  region: config.UCLOUD_REGION || 'cn-wlcb',
  endpoint: config.UCLOUD_ENDPOINT || 'https://xiaoshow.cn-wlcb.ufileos.com',
  bucket: config.UCLOUD_BUCKET || 'xiaoshow',
  host: config.UCLOUD_HOST || 'xiaoshow.cn-wlcb.ufileos.com',
  accessKey: config.UCLOUD_ACCESS_KEY || '4eZCt9AaZ6MGsYvAaZWv64Hnfz40sDxXZ',
  secretKey: config.UCLOUD_SECRET_KEY || 'HGSlexufJmv2GdFAXbG4feFs7Ov993T5k7hkRED9XwDq',
};
let activeUploads = 0;
const MAX_CONCURRENT_UPLOADS = 1;
const uploadQueue = [];
let globalUploadLock = false;

const acquireGlobalUploadLock = async () => {
  let waitTime = 0;
  const maxWaitTime = 30000;
  
  while (globalUploadLock && waitTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    waitTime += 1000;
  }
  
  if (waitTime >= maxWaitTime) {
    globalUploadLock = false;
  }
  
  globalUploadLock = true;
  await new Promise(resolve => setTimeout(resolve, 1000));
};

const releaseGlobalUploadLock = () => {
  globalUploadLock = false;
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

const generateUniqueFileName = (originalName, folder = '') => {
  if (!originalName || typeof originalName !== 'string') {
    originalName = 'unknown_file.jpg';
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

const generateImageFileNames = (originalName, uploadFolder = 'uploads', blurFolder = 'blurs') => {
  if (!originalName || typeof originalName !== 'string') {
    originalName = 'image.jpg';
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

const calculateSignature = (method, publicKey, privateKey, md5, contentType, date, bucketName, fileName) => {  
  const CanonicalizedResource = `/${bucketName}/${fileName}`;
  const StringToSign = method + "\n" 
                     + md5 + "\n" 
                     + contentType + "\n" 
                     + date + "\n"
                     + CanonicalizedResource;
                     
  
  let Signature = CryptoJS.HmacSHA1(StringToSign, privateKey);
  Signature = CryptoJS.enc.Base64.stringify(Signature);
  const Authorization = "UCloud" + " " + publicKey + ":" + Signature;
  
  
  return Authorization;
};

const compressImage = async (filePath, options = {}) => {
  
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(new Error('File path is required for image compression'));
      return;
    }
    
    wx.getImageInfo({
      src: filePath,
      success: (imageInfo) => {
        
        const maxSize = options.maxWidthOrHeight || 1000;
        const needsResize = imageInfo.width > maxSize || imageInfo.height > maxSize;
        
        if (needsResize) {
        }
        
        const quality = Math.floor(Math.min((options.quality || 0.3) * 100, 30));
        
        const compressOptions = {
          src: filePath,
          quality: quality
        };
        
        if (needsResize && imageInfo.width && imageInfo.height) {
          const ratio = Math.min(maxSize / imageInfo.width, maxSize / imageInfo.height);
          compressOptions.compressedWidth = Math.floor(imageInfo.width * ratio);
          compressOptions.compressedHeight = Math.floor(imageInfo.height * ratio);
        }
        
        wx.compressImage({
          ...compressOptions,
          success: (res) => {
            wx.getFileInfo({
              filePath: res.tempFilePath,
              success: (info) => {
                
                const compressionRatio = ((imageInfo.size - info.size) / imageInfo.size * 100);
                
                if (info.size > 0.5 * 1024 * 1024 || compressionRatio < 50) {
                  compressWithCanvas(filePath, options, resolve);
                  return;
                }
                
                resolve(res.tempFilePath);
              },
              fail: () => {
                resolve(res.tempFilePath);
              }
            });
          },
          fail: (error) => {
            compressWithCanvas(filePath, options, resolve);
          }
        });
      },
      fail: (error) => {
        wx.compressImage({
          src: filePath,
          quality: 30,
          success: (res) => {
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

const compressWithCanvas = (filePath, options, resolve) => {
    
  wx.getImageInfo({
    src: filePath,
    success: (imageInfo) => {
      
      const maxSize = options.maxWidthOrHeight || 1000;
      let newWidth = imageInfo.width;
      let newHeight = imageInfo.height;
      
      if (imageInfo.width > maxSize || imageInfo.height > maxSize) {
        const ratio = Math.min(maxSize / imageInfo.width, maxSize / imageInfo.height);
        newWidth = Math.floor(imageInfo.width * ratio);
        newHeight = Math.floor(imageInfo.height * ratio);
      }
      
      
      let attempts = 0;
      const maxAttempts = 3;
      const qualities = [20, 15, 10];
      
      const tryCompression = (attemptIndex) => {
        if (attemptIndex >= maxAttempts) {
          resolve(filePath);
          return;
        }
        
        const currentQuality = qualities[attemptIndex];
        
        wx.compressImage({
          src: filePath,
          quality: currentQuality,
          success: (res) => {
            wx.getFileInfo({
              filePath: res.tempFilePath,
              success: (info) => {
                
                if (info.size < 0.8 * 1024 * 1024) {
                  resolve(res.tempFilePath);
                } else {
                  tryCompression(attemptIndex + 1);
                }
              },
              fail: () => {
                tryCompression(attemptIndex + 1);
              }
            });
          },
          fail: () => {
            tryCompression(attemptIndex + 1);
          }
        });
      };
      
      tryCompression(0);
    },
    fail: (error) => {
      resolve(filePath);
    }
  });
};

const createBlurImage = async (filePath) => {
  return new Promise((resolve) => {
    if (!filePath) {
      resolve(filePath);
      return;
    }
    
    wx.getImageInfo({
      src: filePath,
      success: (imageInfo) => {
        
        const maxSize = 50;
        const ratio = Math.min(maxSize / imageInfo.width, maxSize / imageInfo.height);
        const canvasWidth = Math.floor(imageInfo.width * ratio);
        const canvasHeight = Math.floor(imageInfo.height * ratio);
        
        
        const ctx = wx.createCanvasContext('blurCanvas');
        
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        ctx.drawImage(filePath, 0, 0, canvasWidth, canvasHeight);
        
        ctx.globalAlpha = 0.5;
        
        for (let i = 0; i < 3; i++) {
          ctx.drawImage(filePath, -1, -1, canvasWidth + 2, canvasHeight + 2);
          ctx.drawImage(filePath, 1, -1, canvasWidth + 2, canvasHeight + 2);
          ctx.drawImage(filePath, -1, 1, canvasWidth + 2, canvasHeight + 2);
          ctx.drawImage(filePath, 1, 1, canvasWidth + 2, canvasHeight + 2);
        }
        
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 5; i++) {
          const offset = i + 2;
          ctx.drawImage(filePath, -offset, -offset, canvasWidth + offset*2, canvasHeight + offset*2);
          ctx.drawImage(filePath, offset, -offset, canvasWidth + offset*2, canvasHeight + offset*2);
          ctx.drawImage(filePath, -offset, offset, canvasWidth + offset*2, canvasHeight + offset*2);
          ctx.drawImage(filePath, offset, offset, canvasWidth + offset*2, canvasHeight + offset*2);
        }
        
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 8; i++) {
          const offset = i * 2 + 5;
          ctx.drawImage(filePath, -offset, 0, canvasWidth + offset*2, canvasHeight);
          ctx.drawImage(filePath, offset, 0, canvasWidth + offset*2, canvasHeight);
          ctx.drawImage(filePath, 0, -offset, canvasWidth, canvasHeight + offset*2);
          ctx.drawImage(filePath, 0, offset, canvasWidth, canvasHeight + offset*2);
        }
        
        ctx.draw(false, () => {
          setTimeout(() => {
            wx.canvasToTempFilePath({
              canvasId: 'blurCanvas',
              x: 0,
              y: 0,
              width: canvasWidth,
              height: canvasHeight,
              destWidth: canvasWidth * 2, // Scale up slightly for better effect
              destHeight: canvasHeight * 2,
              fileType: 'jpg',
              quality: 0.3,
              success: (res) => {
                wx.compressImage({
                  src: res.tempFilePath,
                  quality: 30,
                  success: (compressRes) => {
                    resolve(compressRes.tempFilePath);
                  },
                  fail: () => {
                    resolve(res.tempFilePath);
                  }
                });
              },
              fail: (error) => {
                wx.compressImage({
                  src: filePath,
                  quality: 30,
                  success: (compressRes) => {
                    resolve(compressRes.tempFilePath);
                  },
                  fail: () => {
                    resolve(filePath);
                  }
                });
              }
            });
          }, 100);
        });
      },
      fail: (error) => {
        wx.compressImage({
          src: filePath,
          quality: 30,
          success: (res) => {
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

const generateVideoThumbnail = async (videoPath, providedThumbnailPath = null) => {
  return new Promise((resolve) => {
    if (providedThumbnailPath) {
      wx.getFileInfo({
        filePath: providedThumbnailPath,
        success: (fileInfo) => {
          if (fileInfo.size > 0) {
            resolve(providedThumbnailPath);
          } else {
            generateFallbackThumbnail(videoPath, resolve);
          }
        },
        fail: (error) => {
          generateFallbackThumbnail(videoPath, resolve);
        }
      });
      return;
    }
    
    if (!videoPath) {
      resolve(null);
      return;
    }
    
    generateFallbackThumbnail(videoPath, resolve);
  });
};

const generateFallbackThumbnail = (videoPath, resolve) => {
  
  wx.getVideoInfo({
    src: videoPath,
    success: (videoInfo) => {
      createPlaceholderThumbnail(videoInfo, resolve);
    },
    fail: (error) => {
      createBasicPlaceholderThumbnail(resolve);
    }
  });
};

const createPlaceholderThumbnail = (videoInfo, resolve) => {
  const canvasId = 'thumbnailCanvas';
  const ctx = wx.createCanvasContext(canvasId);
  
  const maxWidth = 320;
  const maxHeight = 180;
  let width = videoInfo.width || maxWidth;
  let height = videoInfo.height || maxHeight;
  
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }
  
  
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  const hue = (videoInfo.size || 0) % 360;
  gradient.addColorStop(0, `hsl(${hue}, 60%, 25%)`);
  gradient.addColorStop(0.5, `hsl(${(hue + 60) % 360}, 50%, 20%)`);
  gradient.addColorStop(1, `hsl(${(hue + 120) % 360}, 60%, 25%)`);
  
  ctx.setFillStyle(gradient);
  ctx.fillRect(0, 0, width, height);
  
  ctx.setFillStyle('#FFFFFF');
  ctx.setGlobalAlpha(0.9);
  const centerX = width / 2;
  const centerY = height / 2;
  const buttonSize = Math.min(width, height) * 0.15;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, buttonSize * 1.5, 0, 2 * Math.PI);
  ctx.setFillStyle('rgba(255, 255, 255, 0.2)');
  ctx.fill();
  
  ctx.setFillStyle('#FFFFFF');
  ctx.beginPath();
  ctx.moveTo(centerX - buttonSize/2, centerY - buttonSize/2);
  ctx.lineTo(centerX - buttonSize/2, centerY + buttonSize/2);
  ctx.lineTo(centerX + buttonSize/2, centerY);
  ctx.closePath();
  ctx.fill();
  
  if (videoInfo.duration) {
    ctx.setFillStyle('rgba(0, 0, 0, 0.7)');
    ctx.fillRect(width - 50, height - 20, 45, 15);
    ctx.setFillStyle('#FFFFFF');
    ctx.setFontSize(10);
    ctx.setGlobalAlpha(1);
    const duration = Math.floor(videoInfo.duration);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    ctx.fillText(durationText, width - 47, height - 8);
  }
  
  ctx.setFillStyle('rgba(0, 150, 255, 0.8)');
  ctx.fillRect(5, 5, 35, 15);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(8);
  ctx.fillText('VIDEO', 8, 15);
  
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
          resolve(res.tempFilePath);
        },
        fail: (error) => {
          resolve(null);
        }
      });
    }, 200);
  });
};

const createBasicPlaceholderThumbnail = (resolve) => {
  const canvasId = 'thumbnailCanvas';
  const ctx = wx.createCanvasContext(canvasId);
  const width = 320;
  const height = 180;
  
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#2d2d2d');
  gradient.addColorStop(1, '#1a1a1a');
  
  ctx.setFillStyle(gradient);
  ctx.fillRect(0, 0, width, height);
  
  const centerX = width / 2;
  const centerY = height / 2;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
  ctx.setFillStyle('rgba(255, 255, 255, 0.9)');
  ctx.fill();
  
  ctx.setFillStyle('#333333');
  ctx.beginPath();
  ctx.moveTo(centerX - 10, centerY - 12);
  ctx.lineTo(centerX - 10, centerY + 12);
  ctx.lineTo(centerX + 15, centerY);
  ctx.closePath();
  ctx.fill();
  
  ctx.setFillStyle('rgba(0, 150, 255, 0.8)');
  ctx.fillRect(5, 5, 35, 15);
  ctx.setFillStyle('#FFFFFF');
  ctx.setFontSize(8);
  ctx.fillText('VIDEO', 8, 15);
  
  ctx.draw(false, () => {
    setTimeout(() => {
      wx.canvasToTempFilePath({
        canvasId: canvasId,
        fileType: 'jpg',
        quality: 0.8,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (error) => {
          resolve(null);
        }
      });
    }, 200);
  });
};

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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

const uploadFileToUCloud = async (filePath, fileName, onProgress) => {
    
  await acquireGlobalUploadLock();
  
  await waitForUploadSlot();
  
  return new Promise((resolve, reject) => {
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
    
    
    wx.getFileInfo({
      filePath: filePath,
      success: (fileInfo) => {
        const fileSize = fileInfo.size;
        const contentType = getContentType(fileName);
        
        
        try {
          const fileData = wx.getFileSystemManager().readFileSync(filePath);
          
          const authorization = calculateSignature('PUT', US3_CONFIG.accessKey, US3_CONFIG.secretKey, '', contentType, '', US3_CONFIG.bucket, fileName);
          const uploadUrl = `https://${US3_CONFIG.host}/${fileName}`;
          
          
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
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const finalUrl = `https://${US3_CONFIG.host}/${fileName}`;
                resolve({
                  url: finalUrl,
                  size: fileSize,
                  fileName: fileName
                });
              } else {
                reject(new Error(`Upload failed: ${res.errMsg || res.data} (${res.statusCode})`));
              }
            },
            fail: (error) => {
              releaseUploadSlot();
              releaseGlobalUploadLock();
              reject(new Error(`Upload request failed: ${error.errMsg}`));
            }
          });
          
          if (onProgress) {
            let progress = 0;
            const progressInterval = setInterval(() => {
              progress = Math.min(progress + 10, 90);
              onProgress(progress);
              if (progress >= 90) {
                clearInterval(progressInterval);
                setTimeout(() => onProgress(100), 500);
              }
            }, 100);
          }
        } catch (error) {
          releaseUploadSlot();
          releaseGlobalUploadLock();
          reject(new Error(`Upload preparation failed: ${error.message}`));
        }
      },
      fail: (error) => {
        releaseUploadSlot();
        releaseGlobalUploadLock();
        reject(error);
      }
    });
  });
};

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

const uploadImage = async (filePath, onProgress = null, uploadFolder = 'uploads', blurFolder = 'blurs') => {
  try {
    if (!filePath) {
      throw new Error('File path is required for image upload');
    }
    
    const originalName = filePath.split('/').pop() || 'image.jpg';
    
    const fileNames = generateImageFileNames(originalName, uploadFolder, blurFolder);
    
    let uploadedCount = 0;
    const totalUploads = 2;
    
    const progressCallback = (percent) => {
      if (onProgress) {
        const totalProgress = Math.round(((uploadedCount * 100) + percent) / totalUploads);
        onProgress(totalProgress);
      }
    };
    
    const compressedPath = await compressImage(filePath, {
      quality: 0.3,
      maxWidthOrHeight: 1600
    });
    
    const blurPath = await createBlurImage(filePath);
    
    let uploadResult, blurResult;
    
    try {
      uploadResult = await uploadToUCloud(compressedPath, fileNames.upload, progressCallback);
      uploadedCount++;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (uploadError) {
      throw uploadError;
    }
    
    try {
      blurResult = await uploadToUCloud(blurPath, fileNames.blur, progressCallback);
      uploadedCount++;
    } catch (blurError) {
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
    throw error;
  }
};

const uploadVideo = async (filePath, onProgress = null, videoFolder = 'videos', thumbnailFolder = 'thumbnails', providedThumbnailPath = null) => {
  try {
    if (!filePath) {
      throw new Error('File path is required for video upload');
    }
    
    const originalName = filePath.split('/').pop() || 'video.mp4';
    
    const { fileName } = generateUniqueFileName(originalName, videoFolder);
    
    let uploadedCount = 0;
    const progressCallback = (percent) => {
      if (onProgress) {
        const totalUploads = 2; // video + thumbnail
        const totalProgress = Math.round(((uploadedCount * 100) + percent) / totalUploads);
        onProgress(totalProgress);
      }
    };
    
    // Process and upload thumbnail
    let thumbnailUrl = null;
    
    try {
      // Check if we have a real thumbnail from wx.chooseMedia
      if (providedThumbnailPath) {
        
        // Verify thumbnail file exists and is valid
        try {
          const thumbFileInfo = await new Promise((resolve, reject) => {
            wx.getFileInfo({
              filePath: providedThumbnailPath,
              success: resolve,
              fail: reject
            });
          });
          
          
          if (thumbFileInfo.size > 0) {
            const thumbnailName = `${thumbnailFolder}/${fileName.split('/').pop().replace(/\.[^.]+$/, '_thumb.jpg')}`;
            
            // Optimize the real thumbnail before upload
            let optimizedThumbnailPath = providedThumbnailPath;
            
            try {
              console.log('MANDATORY thumbnail compression...');
              optimizedThumbnailPath = await compressImage(providedThumbnailPath, {
                quality: 0.4, // Higher compression for thumbnails - 40% quality
                maxWidthOrHeight: 800 // Smaller dimensions for thumbnails - max 800px
              });
              console.log('MANDATORY thumbnail compression complete');
              
              // Verify thumbnail compression
              try {
                const originalSize = await new Promise((resolve) => {
                  wx.getFileInfo({ filePath: providedThumbnailPath, success: (info) => resolve(info.size), fail: () => resolve(0) });
                });
                const compressedSize = await new Promise((resolve) => {
                  wx.getFileInfo({ filePath: optimizedThumbnailPath, success: (info) => resolve(info.size), fail: () => resolve(0) });
                });
                const compressionRatio = originalSize > 0 ? ((originalSize - compressedSize) / originalSize * 100).toFixed(1) : 0;
                console.log(`Thumbnail compression: ${originalSize} -> ${compressedSize} bytes (${compressionRatio}% reduction)`);
              } catch (error) {
                console.warn('Could not verify thumbnail compression ratio:', error);
              }
            } catch (optimizationError) {
              console.error('MANDATORY thumbnail compression failed:', optimizationError);
              throw new Error('Thumbnail compression is mandatory but failed');
            }
            
            // Upload the real thumbnail
            const thumbnailResult = await uploadToUCloud(optimizedThumbnailPath, thumbnailName, progressCallback);
            thumbnailUrl = thumbnailResult.url;
            uploadedCount++;
            console.log('Real thumbnail uploaded successfully:', thumbnailUrl);
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw new Error('Empty thumbnail file');
          }
        } catch (thumbError) {
          const fallbackThumbnail = await generateVideoThumbnail(filePath, null);
          if (fallbackThumbnail) {
            const thumbnailName = `${thumbnailFolder}/${fileName.split('/').pop().replace(/\.[^.]+$/, '_thumb.jpg')}`;
            const thumbnailResult = await uploadToUCloud(fallbackThumbnail, thumbnailName, progressCallback);
            thumbnailUrl = thumbnailResult.url;
          }
          uploadedCount++;
        }
      } else {
        const fallbackThumbnail = await generateVideoThumbnail(filePath, null);
        if (fallbackThumbnail) {
          const thumbnailName = `${thumbnailFolder}/${fileName.split('/').pop().replace(/\.[^.]+$/, '_thumb.jpg')}`;
          const thumbnailResult = await uploadToUCloud(fallbackThumbnail, thumbnailName, progressCallback);
          thumbnailUrl = thumbnailResult.url;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        uploadedCount++;
      }
    } catch (error) {
      uploadedCount++;
    }
    
    let compressedVideoPath = filePath;
    try {
      compressedVideoPath = await compressVideo(filePath, {
        quality: 'medium',
        bitrate: 1000,
        fps: 24,
        resolution: 0.8
      });
    } catch (compressionError) {
      compressedVideoPath = filePath;
    }
    
    const result = await uploadToUCloud(compressedVideoPath, fileName, progressCallback);
    uploadedCount++;
    
    return {
      videoUrl: result.url,
      thumbnailUrl: thumbnailUrl,
      fileName: fileName,
      originalName: originalName,
      videoSize: result.size,
      thumbnailSize: thumbnailUrl ? 0 : 0,
      folders: {
        video: videoFolder,
        thumbnail: thumbnailFolder
      },
      hasRealThumbnail: !!providedThumbnailPath && !!thumbnailUrl
    };
  } catch (error) {
    throw error;
  }
};

const uploadAudio = async (filePath, onProgress = null, audioFolder = 'audios') => {
  try {
    if (!filePath) {
      throw new Error('File path is required for audio upload');
    }
    
    const originalName = filePath.split('/').pop() || 'audio.mp3';
    
    const { fileName } = generateUniqueFileName(originalName, audioFolder);
    
    const compressedAudioPath = await compressAudio(filePath);
    
    const result = await uploadToUCloud(compressedAudioPath, fileName, onProgress);
    
    return {
      audioUrl: result.url,
      fileName: fileName,
      originalName: originalName,
      audioSize: result.size,
      folder: audioFolder
    };
  } catch (error) {
    throw error;
  }
};

const uploadMedia = async (file, onProgress = null, folders = {}) => {
  if (!file) {
    throw new Error('File parameter is required');
  }
  
  const filePath = file.tempFilePath || file.path || file.url;
  if (!filePath) {
    throw new Error('File path is required');
  }
  
  const thumbnailPath = file.thumbTempFilePath || null;
  
  let fileName = file.name || file.tempFilePath?.split('/').pop() || file.path?.split('/').pop() || file.url?.split('/').pop();
  if (!fileName || typeof fileName !== 'string') {
    const timestamp = Date.now();
    fileName = `file_${timestamp}.jpg`;
  }
  
  const isImage = /\.(jpg|jpeg|png|gif|bmp|heic|webp)$/i.test(fileName);
  const isVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(fileName);
  const isAudio = /\.(mp3|wav|aac|m4a|flac|ogg|wma)$/i.test(fileName);
  
  if (!isImage && !isVideo && !isAudio) {
    if (file.type) {
      if (file.type.startsWith('image/')) {
        fileName = fileName.replace(/\.[^.]*$/, '.jpg');
      } else if (file.type.startsWith('video/')) {
        fileName = fileName.replace(/\.[^.]*$/, '.mp4');
      } else if (file.type.startsWith('audio/')) {
        fileName = fileName.replace(/\.[^.]*$/, '.mp3');
      }
    }
  }
  
  const finalIsImage = /\.(jpg|jpeg|png|gif|bmp|heic|webp)$/i.test(fileName);
  const finalIsVideo = /\.(mp4|mov|avi|wmv|flv|webm)$/i.test(fileName);
  const finalIsAudio = /\.(mp3|wav|aac|m4a|flac|ogg|wma)$/i.test(fileName);
  
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
      result = await uploadVideo(filePath, onProgress, folderConfig.video, folderConfig.thumbnail, thumbnailPath);
    } else if (finalIsAudio) {
      result = await uploadAudio(filePath, onProgress, folderConfig.audio);
    } else {
      throw new Error('Unsupported file type: ' + fileName);
    }
    
    if (!result) {
      throw new Error('Upload result is empty');
    }
    
    return result;
  } catch (error) {
    throw error;
  }
};

const uploadMultipleMedia = async (files, onProgress = null, folders = {}) => {
  const results = [];
  const totalFiles = files.length;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    const fileProgressCallback = (percent) => {
      if (onProgress) {
        const totalProgress = Math.round(((i * 100) + percent) / totalFiles);
        onProgress(totalProgress, i, file.name || 'file');
      }
    };
    
    try {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      const result = await uploadMedia(file, fileProgressCallback, folders);
      results.push({ success: true, file: file.name || 'file', data: result });
    } catch (error) {
      results.push({ success: false, file: file.name || 'file', error: error.message });
    }
  }
  
  return results;
};

const uploadImageSimple = async (filePath, onProgress = null, uploadFolder = 'uploads') => {
  try {
    if (!filePath) {
      throw new Error('File path is required for image upload');
    }
    
    const originalName = filePath.split('/').pop() || 'image.jpg';
    
    const { fileName } = generateUniqueFileName(originalName, uploadFolder);
    
    let compressedPath;
    try {
      compressedPath = await compressImage(filePath, {
        quality: 0.3,
        maxWidthOrHeight: 1000
      });
    } catch (compressionError) {
      compressedPath = filePath;
    }
    
    try {
      const uploadResult = await uploadToUCloud(compressedPath, fileName, onProgress);
      
      return {
        url: uploadResult.url,
        uploadUrl: uploadResult.url,
        fileName: fileName,
        originalName: originalName,
        size: uploadResult.size,
        folder: uploadFolder
      };
    } catch (uploadError) {
      throw uploadError;
    }
  } catch (error) {
    throw error;
  }
};

const compressAudio = async (filePath, options = {}) => {
  return new Promise((resolve) => {
    if (!filePath) {
      resolve(filePath);
      return;
    }
    
    wx.getFileInfo({
      filePath: filePath,
      success: (fileInfo) => {
        resolve(filePath);
      },
      fail: (error) => {
        resolve(filePath);
      }
    });
  });
};

const compressVideo = async (filePath, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(new Error('File path is required'));
      return;
    }
    
    if (typeof wx.compressVideo === 'function') {
      wx.compressVideo({
        src: filePath,
        quality: options.quality || 'high',
        bitrate: options.bitrate || 3000,
        fps: options.fps || 24,
        resolution: options.resolution || 1.0,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (error) => {
          resolve(filePath);
        }
      });
    } else {
      wx.getFileInfo({
        filePath: filePath,
        success: (fileInfo) => {
          const fileSizeMB = fileInfo.size / (1024 * 1024);
          
          if (fileSizeMB > 200) {
            reject(new Error('Video file too large and compression not available'));
          } else {
            resolve(filePath);
          }
        },
        fail: (error) => {
          reject(error);
        }
      });
    }
  });
};

const testUpload = async (filePath) => {
  try {
    const compressedPath = await compressImage(filePath, { quality: 0.3, maxWidthOrHeight: 1000 });
    
    const fileInfo = await new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath: compressedPath,
        success: resolve,
        fail: reject
      });
    });
    
    const uploadResult = await uploadImageSimple(filePath, null, 'test_uploads');
    
    return uploadResult;
  } catch (error) {
    throw error;
  }
};

// Export functions
module.exports = {
  uploadImage,
  uploadImageSimple,
  uploadVideo,
  uploadAudio,
  uploadMedia,
  uploadMultipleMedia,
  US3_CONFIG,
  compressImage,
  compressVideo,
  compressAudio,
  createBlurImage,
  generateVideoThumbnail,
  testUpload
};