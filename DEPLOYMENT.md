# Deployment Guide

This guide will help you deploy your AI Website to various platforms including Vercel and Coolify with proper database connectivity.

## Coolify Deployment (Recommended for Self-Hosting)

### Prerequisites
- Coolify instance running
- Backend API deployed separately
- Docker support

### 1. Create a new project in Coolify
- Go to your Coolify dashboard
- Create a new project
- Choose "Git Repository" as source

### 2. Configure the application
- **Repository**: Your GitHub repository URL
- **Branch**: main (or your preferred branch)
- **Build Pack**: Docker
- **Dockerfile**: `Dockerfile` (in root directory)

### 3. Environment Variables in Coolify
Set the following environment variables:

```
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
DATABASE_URL=postgresql://username:password@host:port/database?schema=public
NODE_ENV=production
```

### 4. Build Configuration
- **Port**: 3000
- **Health Check Path**: `/`

## Vercel Deployment

This guide will help you deploy your AI Website to Vercel with proper database connectivity.

## Prerequisites

1. A production PostgreSQL database (Vercel Postgres, Supabase, Railway, Neon, etc.)
2. Vercel account
3. All required API keys

## Step 1: Set up Production Database

### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the connection string provided

### Option B: External PostgreSQL Provider
- **Supabase**: Create project → Settings → Database → Connection string
- **Railway**: Create PostgreSQL service → Connect tab → Connection URL
- **Neon**: Create project → Dashboard → Connection string

## Step 2: Configure Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables:

```
DATABASE_URL=your_production_postgres_url_here
GOOGLE_GEMINI_API_KEY=your_gemini_api_key
FACEBOOK_ACCESS_TOKEN=your_facebook_token
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
NODE_ENV=production
```

## Step 3: Database Migration Strategy

The build process will automatically:
1. Generate Prisma client
2. Run database migrations
3. Build the Next.js application

### Manual Migration (if needed)
If automatic migration fails, you can run:
```bash
npm run db:migrate
```

## Step 4: Deploy

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically deploy using the `vercel-build` script

## Troubleshooting Database Connection Issues

### Common Issues:

1. **"Table does not exist" error**
   - Ensure `DATABASE_URL` is correctly set in Vercel environment variables
   - Check that migrations ran successfully during build
   - Manually run migrations if needed

2. **Connection timeout**
   - Verify your database allows connections from Vercel's IP ranges
   - Check if your database requires SSL (add `?sslmode=require` to connection string)

3. **Authentication failed**
   - Double-check username, password, and database name in connection string
   - Ensure database user has proper permissions

### Database URL Format Examples:

```bash
# Vercel Postgres
postgres://username:password@host:port/database

# Supabase
postgresql://postgres:[password]@[host]:5432/postgres?sslmode=require

# Railway
postgresql://postgres:[password]@[host]:5432/railway

# Neon
postgresql://[user]:[password]@[host]/[dbname]?sslmode=require
```

## Verification

After deployment:
1. Check Vercel function logs for any database connection errors
2. Test the NestJS backend endpoints:
   - `http://localhost:3002/api/posts` (scheduled posts)
   - `http://localhost:3002/api/scheduler/status` (scheduler status)
3. Verify data persistence across deployments
4. Ensure the NestJS scheduler backend is running on port 3002

## Local Development vs Production

- **Local**: Uses `build:local` script (no migrations)
- **Production**: Uses `build` or `vercel-build` script (includes migrations)

This ensures your local development database remains separate from production.