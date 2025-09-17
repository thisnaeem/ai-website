import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export async function POST(request: NextRequest) {
  try {
    const { publicId, cloudName, apiKey, apiSecret, resourceType } = await request.json();

    if (!publicId || !cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Public ID and Cloudinary credentials are required' }, { status: 400 });
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || 'image'
    });
    
    if (result.result === 'ok') {
      return NextResponse.json({ 
        success: true,
        message: 'File deleted successfully from Cloudinary'
      });
    } else {
      throw new Error(`Failed to delete file: ${result.result}`);
    }
    
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete from Cloudinary' },
      { status: 500 }
    );
  }
}