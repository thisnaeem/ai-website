import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { postId, message, accessToken } = await request.json();

    if (!postId || !message || !accessToken) {
      return NextResponse.json({ error: 'Post ID, message, and access token are required' }, { status: 400 });
    }

    // Post comment to Facebook using Graph API
    const formData = new URLSearchParams();
    formData.append('message', message);
    formData.append('access_token', accessToken);
    
    const facebookResponse = await fetch(`https://graph.facebook.com/v18.0/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });

    if (!facebookResponse.ok) {
      const errorData = await facebookResponse.json();
      console.error('Facebook API Error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to post comment to Facebook' },
        { status: facebookResponse.status }
      );
    }

    const commentData = await facebookResponse.json();
    
    return NextResponse.json({ 
      success: true, 
      commentId: commentData.id,
      message: 'Comment posted successfully'
    });
    
  } catch (error) {
    console.error('Error posting comment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post comment' },
      { status: 500 }
    );
  }
}