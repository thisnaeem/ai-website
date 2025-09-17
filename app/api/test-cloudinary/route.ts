import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export async function POST(request: NextRequest) {
  try {
    const { cloudName, apiKey, apiSecret } = await request.json();

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'All Cloudinary credentials are required' }, { status: 400 });
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

    // Test the connection by getting account details
    const result = await cloudinary.api.ping();
    
    if (result.status === 'ok') {
      return NextResponse.json({ 
        success: true, 
        message: 'Cloudinary connection successful',
        cloudName: cloudName
      });
    } else {
      throw new Error('Cloudinary ping failed');
    }
    
  } catch (error) {
    console.error('Error testing Cloudinary connection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to Cloudinary' },
      { status: 500 }
    );
  }
}