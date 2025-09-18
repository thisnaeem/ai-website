#!/usr/bin/env node

// This script handles failed migrations specifically for Vercel deployment
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

function runCommand(command, options = {}) {
  try {
    console.log(`Running: ${command}`);
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    return false;
  }
}

async function handleVercelDeployment() {
  console.log('Starting Vercel pre-deployment migration handling...');
  
  // First, try to reset the database to a clean state
  console.log('Resetting database to clean state...');
  const resetSuccess = runCommand('npx prisma migrate reset --force --skip-seed');
  
  if (resetSuccess) {
    console.log('Database reset successful, deploying all migrations...');
    const deploySuccess = runCommand('npx prisma migrate deploy');
    
    if (deploySuccess) {
      console.log('Migrations deployed successfully!');
      
      // Create the required Facebook page after successful migration
      const prisma = new PrismaClient();
      try {
        await prisma.facebookPage.create({
          data: {
            id: '714750088378383',
            name: 'Placeholder Page',
            accessToken: 'PLACEHOLDER_TOKEN',
            picture: null,
            followersCount: null,
          }
        });
        console.log('Required Facebook page created successfully.');
      } catch (error) {
        console.log('Facebook page may already exist, continuing...');
      } finally {
        await prisma.$disconnect();
      }
    } else {
      console.error('Migration deployment failed after reset!');
      process.exit(1);
    }
  } else {
    console.log('Database reset failed, trying alternative approach...');
    
    // Alternative: try to resolve the specific failed migration
    console.log('Attempting to mark failed migration as rolled back...');
    runCommand('npx prisma migrate resolve --rolled-back "20250918091354_add_facebook_pages"');
    
    // Deploy migrations
    console.log('Deploying migrations...');
    const deploySuccess = runCommand('npx prisma migrate deploy');
    
    if (!deploySuccess) {
      console.error('Migration deployment failed!');
      process.exit(1);
    }
  }
  
  console.log('Migration handling completed successfully!');
}

handleVercelDeployment().catch((error) => {
  console.error('Pre-deployment script failed:', error);
  process.exit(1);
});