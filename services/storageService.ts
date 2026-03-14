// src/services/storageService.ts
import { supabase } from './supabaseClient';

/**
 * 前端压缩图片
 * 利用 Canvas 将图片缩放并以 jpeg 重新编码，大幅减小文件体积
 *
 * @param file      原始图片文件
 * @param maxWidth  最大宽度（px），超过则等比缩小，默认 1200
 * @param quality   jpeg 质量 0~1，默认 0.82
 * @returns         压缩后的 File 对象（格式统一为 jpeg）
 */
async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.82
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // 计算压缩后尺寸，宽度超限才缩小，否则保持原尺寸
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 不可用'));
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('图片压缩失败'));
          // 保留原文件名，后缀改为 .jpg
          const compressedName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          resolve(new File([blob], compressedName, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // 压缩失败时静默回退，上传原图，不影响主流程
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * 上传图片到 Supabase Storage（上传前自动压缩）
 * @param file 图片文件
 * @param bucket 存储桶名称
 * @param folder 文件夹路径（可选）
 * @returns 图片的公开URL
 */
export async function uploadImage(
  file: File,
  bucket: 'user_images' | 'comment_images' | 'forum_images' = 'forum_images',
  folder?: string
): Promise<string> {
  try {
    // 压缩图片，gif 不压缩（压缩会丢失动画）
    const fileToUpload = file.type === 'image/gif' ? file : await compressImage(file);

    // 生成唯一文件名（统一用 .jpg，gif 保留原扩展名）
    const fileExt = file.type === 'image/gif' ? 'gif' : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // 上传文件
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  } catch (error: any) {
    console.error('上传图片失败:', error);
    throw new Error(`上传图片失败: ${error.message}`);
  }
}

/**
 * 批量上传图片
 * @param files 图片文件数组
 * @param bucket 存储桶名称
 * @param folder 文件夹路径（可选）
 * @param onProgress 进度回调
 * @returns 图片URL数组
 */
export async function uploadImages(
  files: File[],
  bucket: 'user_images' | 'comment_images' | 'forum_images' = 'forum_images',
  folder?: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const urls: string[] = [];

  for (let i = 0; i < files.length; i++) {
    try {
      const url = await uploadImage(files[i], bucket, folder);
      urls.push(url);

      if (onProgress) {
        onProgress(i + 1, files.length);
      }
    } catch (error) {
      console.error(`上传第 ${i + 1} 张图片失败:`, error);
      throw error;
    }
  }

  return urls;
}

/**
 * 删除图片
 * @param url 图片URL或路径
 * @param bucket 存储桶名称
 */
export async function deleteImage(
  url: string,
  bucket: 'user_images' | 'comment_images' | 'forum_images' = 'forum_images'
): Promise<void> {
  try {
    const urlParts = url.split('/');
    const filePath = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw error;
  } catch (error: any) {
    console.error('删除图片失败:', error);
    throw new Error(`删除图片失败: ${error.message}`);
  }
}

/**
 * 删除多张图片
 * @param urls 图片URL数组
 * @param bucket 存储桶名称
 */
export async function deleteImages(
  urls: string[],
  bucket: 'user_images' | 'comment_images' | 'forum_images' = 'forum_images'
): Promise<void> {
  try {
    const filePaths = urls.map(url => {
      const urlParts = url.split('/');
      return urlParts[urlParts.length - 1];
    });

    const { error } = await supabase.storage
      .from(bucket)
      .remove(filePaths);

    if (error) throw error;
  } catch (error: any) {
    console.error('批量删除图片失败:', error);
    throw new Error(`批量删除图片失败: ${error.message}`);
  }
}