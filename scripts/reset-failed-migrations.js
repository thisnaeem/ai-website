const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

async function resetFailedMigrations() {
  try {
    console.log('Checking for failed migrations...');
    
    // Check migration status
    try {
      execSync('npx prisma migrate status', { stdio: 'inherit' });
      console.log('No failed migrations found.');
    } catch (error) {
      console.log('Failed migrations detected. Attempting to resolve...');
      
      try {
        // Try to mark the failed migration as rolled back
        execSync('npx prisma migrate resolve --rolled-back "20250918091354_add_facebook_pages"', { stdio: 'inherit' });
        console.log('Marked failed migration as rolled back.');
      } catch (resolveError) {
        console.log('Could not mark migration as rolled back, continuing with deploy...');
      }
      
      // Deploy migrations
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('Migrations deployed successfully.');
    }
    
    // Ensure facebook_pages table has required data
    const pageCount = await prisma.facebookPage.count();
    if (pageCount === 0) {
      console.log('Creating placeholder Facebook page...');
      await prisma.facebookPage.create({
        data: {
          id: '714750088378383',
          name: 'Placeholder Page',
          accessToken: 'PLACEHOLDER_TOKEN',
          picture: null,
          followersCount: null,
        }
      });
      console.log('Placeholder Facebook page created.');
    }
    
    console.log('Database migration reset completed successfully!');
    
  } catch (error) {
    console.error('Error during migration reset:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetFailedMigrations();