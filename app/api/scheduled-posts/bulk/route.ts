import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Bulk operations on scheduled posts
export async function POST(request: NextRequest) {
  try {
    const { action, pageId } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'stop_automation':
        // Stop automation for specific page or all pages
        const whereCondition = pageId && pageId !== 'all' 
          ? { pageId, status: 'scheduled' }
          : { status: 'scheduled' };
        
        result = await prisma.scheduledPost.updateMany({
          where: whereCondition,
          data: {
            status: 'cancelled'
          }
        });
        
        return NextResponse.json({
          message: `Stopped automation for ${result.count} posts`,
          count: result.count
        });

      case 'delete_all':
        // Delete all scheduled posts for specific page or all pages
        const deleteCondition = pageId && pageId !== 'all'
          ? { pageId, status: 'scheduled' }
          : { status: 'scheduled' };
        
        result = await prisma.scheduledPost.deleteMany({
          where: deleteCondition
        });
        
        return NextResponse.json({
          message: `Deleted ${result.count} scheduled posts`,
          count: result.count
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}