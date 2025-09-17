import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Get all scheduled posts that are due to be posted
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    const duePosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: {
          lte: now
        }
      }
    });

    console.log(`Found ${duePosts.length} posts due for posting`);
    
    // Debug: also get all scheduled posts to compare
    const allScheduled = await prisma.scheduledPost.findMany({
      where: {
        status: 'scheduled'
      }
    });
    
    console.log('All scheduled posts:', allScheduled.map(p => ({
      id: p.id,
      scheduledFor: p.scheduledFor.toISOString(),
      isDue: p.scheduledFor <= now
    })));

    const results = [];

    for (const post of duePosts) {
      try {
        // Update status to processing
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: { status: 'processing' }
        });

        // Get Facebook pages from the request or you might need to store access tokens in the database
        const facebookPages = JSON.parse(request.headers.get('x-facebook-pages') || '[]') as Array<{id: string, accessToken: string}>;
        const selectedPage = facebookPages.find((page) => page.id === post.pageId);

        if (!selectedPage) {
          throw new Error('Facebook page not found or access token missing');
        }

        // Prepare the post data
        const postData: {
          pageId: string;
          postType: string;
          content: string | null;
          carouselImages?: string[];
          mediaUrl?: string;
        } = {
          pageId: post.pageId,
          postType: post.postType,
          content: post.content,
        };

        // Add media URLs based on post type
        if (post.postType === 'carousel' && post.carouselImages.length > 0) {
          postData.carouselImages = post.carouselImages;
        } else if (post.mediaUrls.length > 0) {
          postData.mediaUrl = post.mediaUrls[0];
        }

        // Post to Facebook
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? 'https://your-domain.com' 
          : 'http://localhost:3000';
        
        const facebookResponse = await fetch(`${baseUrl}/api/facebook-post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-facebook-pages': JSON.stringify(facebookPages)
          },
          body: JSON.stringify(postData)
        });

        if (!facebookResponse.ok) {
          let errorMessage = 'Failed to post to Facebook';
          try {
            const errorData = await facebookResponse.json();
            errorMessage = errorData.error?.message || errorData.error || errorMessage;
          } catch (parseError) {
            errorMessage = `HTTP ${facebookResponse.status}: ${facebookResponse.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const facebookResult = await facebookResponse.json();

        // Post first comment if enabled
        if (post.postFirstComment && post.firstComment) {
          try {
            await fetch(`${baseUrl}/api/facebook-comment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                postId: facebookResult.postId,
                message: post.firstComment,
                accessToken: selectedPage.accessToken
              })
            });
          } catch (commentError) {
            console.error('Failed to post comment:', commentError);
          }
        }

        // Update post status to posted
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'posted',
            postedAt: now,
            facebookPostId: facebookResult.postId
          }
        });

        // Note: Recurring posts are handled by the automation system
        // Each file upload creates individual scheduled posts with staggered times
        // No need to create additional recurring posts here

        results.push({
          postId: post.id,
          status: 'success',
          facebookPostId: facebookResult.postId
        });

      } catch (error) {
        console.error(`Error posting scheduled post ${post.id}:`, error);
        
        // Update post status to failed
        await prisma.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        results.push({
          postId: post.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${duePosts.length} scheduled posts`,
      results
    });

  } catch (error) {
    console.error('Error processing scheduled posts:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled posts' },
      { status: 500 }
    );
  }
}

// GET endpoint for manual triggering or health check
export async function GET() {
  try {
    const now = new Date();
    const duePosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: {
          lte: now
        }
      },
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        status: true
      }
    });

    return NextResponse.json({
      message: `Found ${duePosts.length} posts due for posting`,
      duePosts
    });
  } catch (error) {
    console.error('Error checking scheduled posts:', error);
    return NextResponse.json(
      { error: 'Failed to check scheduled posts' },
      { status: 500 }
    );
  }
}