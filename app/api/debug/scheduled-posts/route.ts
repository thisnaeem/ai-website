import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const posts = await prisma.scheduledPost.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    const now = new Date();
    
    return NextResponse.json({
      currentTime: now.toISOString(),
      posts: posts.map(post => ({
        id: post.id,
        title: post.title,
        status: post.status,
        scheduledFor: post.scheduledFor.toISOString(),
        createdAt: post.createdAt.toISOString(),
        isDue: post.scheduledFor <= now
      }))
    });
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled posts' },
      { status: 500 }
    );
  }
}