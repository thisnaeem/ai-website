import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const facebookPages = await prisma.facebookPage.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ pages: facebookPages });
  } catch (error) {
    console.error('Error fetching Facebook pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Facebook pages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pages } = await request.json();
    
    if (!Array.isArray(pages)) {
      return NextResponse.json(
        { error: 'Pages must be an array' },
        { status: 400 }
      );
    }
    
    // Upsert each page (update if exists, create if not)
    const results = [];
    
    for (const page of pages) {
      const { id, name, accessToken, picture, followersCount } = page;
      
      if (!id || !name || !accessToken) {
        continue; // Skip invalid pages
      }
      
      const upsertedPage = await prisma.facebookPage.upsert({
        where: { id },
        update: {
          name,
          accessToken,
          picture: picture || null,
          followersCount: followersCount || null,
          updatedAt: new Date()
        },
        create: {
          id,
          name,
          accessToken,
          picture: picture || null,
          followersCount: followersCount || null
        }
      });
      
      results.push(upsertedPage);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${results.length} Facebook pages`,
      pages: results
    });
    
  } catch (error) {
    console.error('Error syncing Facebook pages:', error);
    return NextResponse.json(
      { error: 'Failed to sync Facebook pages' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { pageId } = await request.json();
    
    if (!pageId) {
      return NextResponse.json(
        { error: 'Page ID is required' },
        { status: 400 }
      );
    }
    
    await prisma.facebookPage.delete({
      where: { id: pageId }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Facebook page deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting Facebook page:', error);
    return NextResponse.json(
      { error: 'Failed to delete Facebook page' },
      { status: 500 }
    );
  }
}