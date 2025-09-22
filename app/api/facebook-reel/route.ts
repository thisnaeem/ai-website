import { NextRequest, NextResponse } from 'next/server';

// Helper function to check network connectivity
async function checkConnectivity() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    await fetch('https://graph.facebook.com/v23.0/', {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    console.log('Facebook API connectivity check failed:', error);
    return false;
  }
}



export async function POST(request: NextRequest) {
  try {
    const { pageId, content, mediaUrl } = await request.json();

    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    if (!mediaUrl) {
      return NextResponse.json({ error: 'Reel video URL is required' }, { status: 400 });
    }

    // Get Facebook pages from localStorage (this would be passed from frontend)
    // In a real app, you'd store this securely on the server
    const facebookPages = JSON.parse(request.headers.get('x-facebook-pages') || '[]') as Array<{id: string, accessToken: string}>;
    const selectedPage = facebookPages.find((page) => page.id === pageId);
    
    if (!selectedPage) {
      return NextResponse.json({ error: 'Facebook page not found' }, { status: 404 });
    }

    const accessToken = selectedPage.accessToken;

    // Check connectivity first
    const isConnected = await checkConnectivity();
    if (!isConnected) {
      throw new Error('Unable to connect to Facebook API. Please check your internet connection and try again.');
    }

    // Step 1: Initialize reel upload session
    console.log('Step 1: Initializing reel upload session...');
    const formData = new FormData();
    formData.append('upload_phase', 'start');
    formData.append('access_token', accessToken);
    
    const initResponse = await fetch(`https://graph.facebook.com/v22.0/${pageId}/video_reels`, {
      method: 'POST',
      body: formData
    });
    
    if (!initResponse.ok) {
      let errorMessage = `Failed to initialize reel upload: HTTP ${initResponse.status}`;
      try {
        const contentType = initResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await initResponse.json();
          errorMessage = `Failed to initialize reel upload: ${errorData.error?.message || 'Unknown error'}`;
        }
      } catch (parseError) {
        console.error('Failed to parse reel init error response:', parseError);
      }
      throw new Error(errorMessage);
    }
    
    let initData;
    try {
      const contentType = initResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        initData = await initResponse.json();
      } else {
        throw new Error('Facebook API returned non-JSON response for reel initialization');
      }
    } catch (parseError) {
      console.error('Failed to parse reel init response:', parseError);
      throw new Error('Failed to parse Facebook reel initialization response');
    }
    
    console.log('Step 1 - Full response from Facebook:', JSON.stringify(initData, null, 2));
    const { video_id, upload_url } = initData;
    console.log('Step 1 completed: Received video_id:', video_id, 'upload_url:', upload_url);
    
    // Step 2: Download video file from URL
    console.log('Step 2: Downloading video file...');
    const videoResponse = await fetch(mediaUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: HTTP ${videoResponse.status}`);
    }
    
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    console.log('Step 2 completed: Video downloaded, size:', videoBlob.size, 'bytes');
    
    // Step 3: Upload video to rupload.facebook.com
    console.log('Step 3: Uploading video to Facebook servers...');
    
    const uploadResponse = await fetch(upload_url, {
      method: 'POST',
      headers: {
        'Authorization': `OAuth ${accessToken}`,
        'offset': '0',
        'file_size': videoBuffer.byteLength.toString()
      },
      body: videoBuffer
    });
    
    if (!uploadResponse.ok) {
      let errorMessage = `Failed to upload video: HTTP ${uploadResponse.status}`;
      try {
        const responseText = await uploadResponse.text();
        console.error('Upload error response:', responseText);
        errorMessage = `Failed to upload video: ${responseText}`;
      } catch (parseError) {
        console.error('Failed to parse upload error response:', parseError);
      }
      throw new Error(errorMessage);
    }
    
    console.log('Step 3 completed: Video uploaded successfully to Facebook servers');
    
    // Step 4: Publish the reel
    console.log('Step 4: Publishing reel...');
    let publishData;
    
    const publishResponse = await fetch(`https://graph.facebook.com/v22.0/${pageId}/video_reels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_id: video_id,
        upload_phase: 'finish',
        description: content || '',
        access_token: accessToken
      })
    });
    
    if (!publishResponse.ok) {
      let errorMessage = `Failed to publish reel: HTTP ${publishResponse.status}`;
      try {
        const contentType = publishResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await publishResponse.json();
          errorMessage = `Failed to publish reel: ${errorData.error?.message || 'Unknown error'}`;
        }
      } catch (parseError) {
        console.error('Failed to parse publish error response:', parseError);
      }
      throw new Error(errorMessage);
    }
    
    try {
      const contentType = publishResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        publishData = await publishResponse.json();
      } else {
        throw new Error('Facebook API returned non-JSON response for reel publishing');
      }
    } catch (parseError) {
       console.error('Failed to parse publish response:', parseError);
       throw new Error('Failed to parse Facebook reel publish response');
     }
    
    console.log('Step 4 - Full publish response from Facebook:', JSON.stringify(publishData, null, 2));
    
    // Extract reel ID from response
    const reelId = publishData.post_id || publishData.id || publishData.video_id;
    
    if (reelId) {
      console.log(`Step 4 completed: Reel published successfully with ID: ${reelId}`);
      
      // Check reel status immediately after publishing
      try {
        const statusResponse = await fetch(`https://graph.facebook.com/v22.0/${reelId}?fields=status,publish_status&access_token=${accessToken}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('Reel status check:', JSON.stringify(statusData, null, 2));
          
          return NextResponse.json({ 
            success: true, 
            postId: reelId,
            videoId: reelId,
            message: 'Reel uploaded and published successfully',
            status: statusData.status || 'unknown',
            publishStatus: statusData.publish_status || 'unknown',
            note: 'Reel published. Check status above - if processing, it may take a few minutes to appear.',
            statusCheckUrl: `https://graph.facebook.com/v22.0/${reelId}?fields=status,publish_status&access_token=${accessToken}`
          });
        } else {
          console.log('Could not check reel status, but reel was published successfully');
        }
      } catch (statusError) {
        console.error('Error checking reel status:', statusError);
      }
      
      return NextResponse.json({ 
        success: true, 
        postId: reelId,
        videoId: reelId,
        message: 'Reel uploaded and published successfully',
        note: 'Reel published successfully. It may take a few minutes to appear on Facebook.',
        statusCheckUrl: `https://graph.facebook.com/v22.0/${reelId}?fields=status,publish_status&access_token=${accessToken}`
      });
    } else {
      throw new Error('No reel ID returned from Facebook API');
    }
    
  } catch (error) {
    console.error('Error publishing reel to Facebook:', error);
    
    // Enhanced error handling with specific error types
    let errorMessage = 'Failed to publish reel to Facebook';
    let errorCode = 500;
    const errorDetails: { type?: string; suggestion?: string } = {};
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific Facebook API errors
      if (errorMessage.includes('OAuthException')) {
        errorCode = 401;
        errorDetails.type = 'authentication_error';
        errorDetails.suggestion = 'Please check your Facebook access token and permissions';
      } else if (errorMessage.includes('rate limit')) {
        errorCode = 429;
        errorDetails.type = 'rate_limit_error';
        errorDetails.suggestion = 'Please wait before trying again. Facebook limits reel uploads to 30 per 24 hours';
      } else if (errorMessage.includes('video format') || errorMessage.includes('file format')) {
        errorCode = 400;
        errorDetails.type = 'format_error';
        errorDetails.suggestion = 'Please ensure your video meets Facebook reel requirements (MP4, 9:16 aspect ratio, 3-90 seconds)';
      } else if (errorMessage.includes('processing')) {
        errorCode = 202; // Accepted but processing
        errorDetails.type = 'processing_error';
        errorDetails.suggestion = 'Reel upload initiated but processing is delayed. This is a known Facebook issue that can take 6-8 hours';
      } else if (errorMessage.includes('connectivity') || errorMessage.includes('network')) {
        errorCode = 503;
        errorDetails.type = 'network_error';
        errorDetails.suggestion = 'Please check your internet connection and try again';
      } else if (errorMessage.includes('timeout')) {
        errorCode = 408;
        errorDetails.type = 'timeout_error';
        errorDetails.suggestion = 'Request timed out. Please try again with a smaller video file';
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        ...errorDetails,
        timestamp: new Date().toISOString(),
        troubleshooting: {
          commonIssues: [
            'Facebook reels can take 6-8 hours to process and appear',
            'Ensure video is MP4 format, 9:16 aspect ratio, 3-90 seconds duration',
            'Check that Facebook app is in Live mode, not Development mode',
            'Verify page access token has proper permissions'
          ],
          supportLinks: [
            'https://developers.facebook.com/docs/video-api/guides/reels-publishing/',
            'https://developers.facebook.com/community/'
          ]
        }
      },
      { status: errorCode }
    );
  }
}

// GET endpoint to check reel upload status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('test');
    const reelId = searchParams.get('reelId');
    const accessToken = searchParams.get('accessToken');
    
    if (testType === 'connectivity') {
      const isConnected = await checkConnectivity();
      return NextResponse.json({ 
        connected: isConnected,
        message: isConnected ? 'Facebook API is reachable' : 'Cannot reach Facebook API'
      });
    }
    
    if (testType === 'status' && reelId && accessToken) {
      try {
        const statusResponse = await fetch(`https://graph.facebook.com/v22.0/${reelId}?fields=status,publish_status,created_time,updated_time&access_token=${accessToken}`);
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          return NextResponse.json({
            success: true,
            reelId: reelId,
            status: statusData.status || 'unknown',
            publishStatus: statusData.publish_status || 'unknown',
            createdTime: statusData.created_time || 'unknown',
            updatedTime: statusData.updated_time || 'unknown',
            fullResponse: statusData
          });
        } else {
          const errorText = await statusResponse.text();
          return NextResponse.json({
            success: false,
            error: `Failed to check status: ${statusResponse.status}`,
            details: errorText
          }, { status: statusResponse.status });
        }
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Failed to check reel status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ 
      message: 'Facebook Reel API endpoint',
      availableTests: ['connectivity', 'status'],
      usage: {
        connectivity: '?test=connectivity',
        status: '?test=status&reelId=YOUR_REEL_ID&accessToken=YOUR_ACCESS_TOKEN'
      }
    });
  } catch (error) {
    console.error('Error in GET request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}