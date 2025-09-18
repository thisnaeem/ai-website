const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createPlaceholderPage() {
  try {
    console.log('Creating placeholder Facebook page...');
    
    // Create the Facebook page that was mentioned in the error
    const pageId = '714750088378383';
    
    const existingPage = await prisma.facebookPage.findUnique({
      where: { id: pageId }
    });
    
    if (!existingPage) {
      await prisma.facebookPage.create({
        data: {
          id: pageId,
          name: 'Placeholder Page',
          accessToken: 'PLACEHOLDER_TOKEN', // This will need to be updated manually
          picture: null,
          followersCount: null,
        }
      });
      console.log(`Created placeholder Facebook page: ${pageId}`);
    } else {
      console.log(`Facebook page already exists: ${pageId}`);
    }
    
    console.log('Placeholder page creation completed!');
    
  } catch (error) {
    console.error('Error creating placeholder page:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createPlaceholderPage();