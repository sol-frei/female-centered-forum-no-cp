// src/services/storageService.ts
import { supabase } from './supabaseClient';

/**
 * 上传图片到 Supabase Storage
 * @param file 图片文件
 * @param bucket 存储桶名称
 * @param folder 文件夹路径（可选）
 * @returns 图片的公开URL
 */
export async function uploadImage(
  file: File, 
  bucket: 'user_images' | 'comment_images' | 'forum-images' = 'forum-images',
  folder?: string
): Promise<string> {
  try {
    // 生成唯一文件名
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // 上传文件
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
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
  bucket: 'user_images' | 'comment_images' | 'forum-images' = 'forum-images',
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
  bucket: 'user_images' | 'comment_images' | 'forum-images' = 'forum-images'
): Promise<void> {
  try {
    // 从URL中提取文件路径
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
  bucket: 'user_images' | 'comment_images' | 'forum-images' = 'forum-images'
): Promise<void> {
  try {
    // 从URL中提取文件路径
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