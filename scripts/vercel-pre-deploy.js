#!/usr/bin/env node

// This script handles failed migrations specifically for Vercel deployment
const { execSync } = require('child_process');

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
  
  // First, try to check migration status
  const statusSuccess = runCommand('npx prisma migrate status');
  
  if (!statusSuccess) {
    console.log('Migration status check failed, attempting to resolve...');
    
    // Try to resolve the specific failed migration
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