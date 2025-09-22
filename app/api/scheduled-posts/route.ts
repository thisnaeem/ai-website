import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all scheduled posts
export async function GET() {
  try {
    const scheduledPosts = await prisma.scheduledPost.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json(scheduledPosts);
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled posts' },
      { status: 500 }
    );
  }
}

// POST - Create a new scheduled post
export async function POST(request: NextRequest) {
  try {
    const {
      title,
      content,
      postType,
      mediaUrls,
      carouselImages,
      pageId,
      pageName,
      scheduledFor,
      intervalMinutes,
      isRecurring,
      firstComment,
      postFirstComment,
      status,
      facebookPostId,
      postedAt
    } = await request.json();

    if (!title || !pageId || !scheduledFor) {
      return NextResponse.json(
        { error: 'Title, page ID, and scheduled time are required' },
        { status: 400 }
      );
    }

    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        title,
        content: content || null,
        postType,
        mediaUrls: mediaUrls || [],
        carouselImages: carouselImages || [],
        pageId,
        pageName,
        scheduledFor: new Date(scheduledFor),
        intervalMinutes: isRecurring ? intervalMinutes : null,
        isRecurring: isRecurring || false,
        firstComment: firstComment || null,
        postFirstComment: postFirstComment || false,
        status: status || 'scheduled',
        facebookPostId: facebookPostId || null,
        postedAt: postedAt ? new Date(postedAt) : null
      }
    });

    return NextResponse.json(scheduledPost, { status: 201 });
  } catch (error) {
    console.error('Error creating scheduled post:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled post' },
      { status: 500 }
    );
  }
}

// PUT - Update a scheduled post
export async function PUT(request: NextRequest) {
  try {
    const {
      id,
      title,
      content,
      postType,
      mediaUrls,
      carouselImages,
      pageId,
      pageName,
      scheduledFor,
      intervalMinutes,
      isRecurring,
      firstComment,
      postFirstComment,
      status
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const updatedPost = await prisma.scheduledPost.update({
      where: { id },
      data: {
        title,
        content,
        postType,
        mediaUrls,
        carouselImages,
        pageId,
        pageName,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        intervalMinutes,
        isRecurring,
        firstComment,
        postFirstComment,
        status
      }
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('Error updating scheduled post:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled post' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a scheduled post
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    await prisma.scheduledPost.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled post' },
      { status: 500 }
    );
  }
}