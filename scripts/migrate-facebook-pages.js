const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateFacebookPages() {
  try {
    console.log('Starting Facebook pages migration...');
    
    // Get all unique pageIds from scheduled_posts
    const uniquePages = await prisma.scheduledPost.findMany({
      select: {
        pageId: true,
        pageName: true,
      },
      distinct: ['pageId'],
    });
    
    console.log(`Found ${uniquePages.length} unique Facebook pages to migrate`);
    
    // Create Facebook pages for each unique pageId
    for (const page of uniquePages) {
      const existingPage = await prisma.facebookPage.findUnique({
        where: { id: page.pageId }
      });
      
      if (!existingPage) {
        await prisma.facebookPage.create({
          data: {
            id: page.pageId,
            name: page.pageName,
            accessToken: 'PLACEHOLDER_TOKEN', // This will need to be updated manually
            picture: null,
            followersCount: null,
          }
        });
        console.log(`Created Facebook page: ${page.pageName} (${page.pageId})`);
      } else {
        console.log(`Facebook page already exists: ${page.pageName} (${page.pageId})`);
      }
    }
    
    console.log('Facebook pages migration completed successfully!');
    console.log('\nIMPORTANT: Please update the accessToken for each Facebook page manually.');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateFacebookPages();