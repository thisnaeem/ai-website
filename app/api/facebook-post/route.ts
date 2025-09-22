import { NextRequest, NextResponse } from 'next/server';

// Helper function to check network connectivity
async function checkConnectivity() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    await fetch('https://graph.facebook.com/v18.0/', {
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
    const { pageId, postType, content, mediaUrl, carouselImages } = await request.json();

    if (!pageId) {
      return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
    }

    if (!postType) {
      return NextResponse.json({ error: 'Post type is required' }, { status: 400 });
    }

    // Get Facebook pages from localStorage (this would be passed from frontend)
    // In a real app, you'd store this securely on the server
    const facebookPages = JSON.parse(request.headers.get('x-facebook-pages') || '[]') as Array<{id: string, accessToken: string}>;
    const selectedPage = facebookPages.find((page) => page.id === pageId);
    
    if (!selectedPage) {
      return NextResponse.json({ error: 'Facebook page not found' }, { status: 404 });
    }

    const accessToken = selectedPage.accessToken;
    let postData: Record<string, unknown> = {};
    let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;

    switch (postType) {
      case 'text':
        if (!content) {
          return NextResponse.json({ error: 'Content is required for text posts' }, { status: 400 });
        }
        postData = {
          message: content,
          access_token: accessToken
        };
        break;

      case 'image':
        if (!mediaUrl) {
          return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }
        endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
        postData = {
          url: mediaUrl,
          caption: content || '',
          access_token: accessToken
        };
        break;

      case 'video':
        if (!mediaUrl) {
          return NextResponse.json({ error: 'Video URL is required' }, { status: 400 });
        }
        endpoint = `https://graph.facebook.com/v18.0/${pageId}/videos`;
        postData = {
          file_url: mediaUrl,
          description: content || '',
          access_token: accessToken
        };
        break;

      case 'reel':
        if (!mediaUrl) {
          return NextResponse.json({ error: 'Reel URL is required' }, { status: 400 });
        }
        
        // Step 1: Initialize reel upload session
        const initResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/video_reels`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            upload_phase: 'start',
            access_token: accessToken
          })
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
        const { video_id, upload_url } = initData;
        
        // Step 2: Upload video using hosted file URL
        const uploadResponse = await fetch(upload_url, {
          method: 'POST',
          headers: {
            'Authorization': `OAuth ${accessToken}`,
            'file_url': mediaUrl
          }
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload reel video to Facebook');
        }
        
        // Step 3: Publish the reel
        const publishResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/video_reels`, {
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
            console.error('Failed to parse reel publish error response:', parseError);
          }
          throw new Error(errorMessage);
        }
        
        let publishData;
        try {
          const contentType = publishResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            publishData = await publishResponse.json();
          } else {
            throw new Error('Facebook API returned non-JSON response for reel publishing');
          }
        } catch (parseError) {
          console.error('Failed to parse reel publish response:', parseError);
          throw new Error('Failed to parse Facebook reel publish response');
        }
        
        return NextResponse.json({ 
          success: true, 
          postId: publishData.id || video_id,
          message: 'Reel published successfully'
        });
        
        // This break is unreachable but kept for consistency
        break;

      case 'carousel':
        if (!carouselImages || carouselImages.length < 2) {
          return NextResponse.json({ error: 'At least 2 images are required for carousel' }, { status: 400 });
        }
        
        // For carousel posts, we need to upload each image first, then create the post
        const attachedMedia = [];
        
        for (const imageUrl of carouselImages) {
          if (!imageUrl.trim()) continue;
          
          // Upload each image and get media ID
          const uploadResponse = await fetch(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: imageUrl,
              published: false, // Don't publish immediately
              access_token: accessToken
            })
          });
          
          if (!uploadResponse.ok) {
            let errorMessage = `Failed to upload image: HTTP ${uploadResponse.status}`;
            try {
              const contentType = uploadResponse.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await uploadResponse.json();
                errorMessage = `Failed to upload image: ${errorData.error?.message || 'Unknown error'}`;
              }
            } catch (parseError) {
              console.error('Failed to parse image upload error response:', parseError);
            }
            throw new Error(errorMessage);
          }
          
          let uploadData;
          try {
            const contentType = uploadResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              uploadData = await uploadResponse.json();
            } else {
              throw new Error('Facebook API returned non-JSON response for image upload');
            }
          } catch (parseError) {
            console.error('Failed to parse image upload response:', parseError);
            throw new Error('Failed to parse Facebook image upload response');
          }
          attachedMedia.push({ media_fbid: uploadData.id });
        }
        
        postData = {
          message: content || '',
          attached_media: attachedMedia,
          access_token: accessToken
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid post type' }, { status: 400 });
    }

    // Check connectivity first
    const isConnected = await checkConnectivity();
    if (!isConnected) {
      throw new Error('Unable to connect to Facebook API. Please check your internet connection and try again.');
    }
    
    // Make the Facebook API call with timeout and retry logic
    let response: Response | undefined;
    let retries = 3;
    
    while (retries > 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postData),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        break; // Success, exit retry loop
        
      } catch (error) {
        retries--;
        console.log(`Facebook API call failed, retries left: ${retries}`, error);
        
        if (retries === 0) {
          throw new Error(`Failed to connect to Facebook API after 3 attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, (4 - retries) * 2000));
      }
    }

    if (!response) {
      throw new Error('No response received from Facebook API');
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } else {
          const textResponse = await response.text();
          console.error('Non-JSON error response:', textResponse.substring(0, 500));
          errorMessage = `Facebook API returned non-JSON response: ${response.status} ${response.statusText}`;
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
        errorMessage = `Failed to parse Facebook API error response: ${response.status} ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    let responseData;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        const textResponse = await response.text();
        console.error('Non-JSON success response:', textResponse.substring(0, 500));
        throw new Error('Facebook API returned non-JSON response');
      }
    } catch (parseError) {
      console.error('Failed to parse success response:', parseError);
      throw new Error('Failed to parse Facebook API response');
    }
    
    return NextResponse.json({ 
      success: true, 
      postId: responseData.id || responseData.post_id,
      message: 'Post published successfully'
    });
    
  } catch (error) {
    console.error('Error posting to Facebook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post to Facebook' },
      { status: 500 }
    );
  }
}