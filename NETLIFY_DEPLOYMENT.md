# Netlify Deployment Guide

This guide will help you deploy your Git-Driven Renovation Presentation Platform to Netlify.

## Prerequisites

1. Complete the Supabase setup following the `SUPABASE_SETUP.md` guide
2. Create a Netlify account at [https://netlify.com](https://netlify.com)
3. Have your Git repository ready (GitHub, GitLab, or Bitbucket)

## Environment Variables Setup

Before deploying, you need to add your Supabase credentials as environment variables in Netlify:

1. Go to your Netlify dashboard
2. Select your site (or create a new one)
3. Navigate to **Site Settings** → **Environment Variables**
4. Add the following variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

## Deployment Methods

### Method 1: Git-based Deployment (Recommended)

1. **Push your code to Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-git-repo-url>
   git push -u origin main
   ```

2. **Connect to Netlify**:
   - In Netlify dashboard, click "Add new site" → "Import an existing project"
   - Select your Git provider
   - Choose your repository
   - Configure build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `.next`
   - Click "Deploy site"

### Method 2: Manual Deployment via CLI

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**:
   ```bash
   netlify login
   ```

3. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

## Build Configuration

The `netlify.toml` file in your project root handles the build configuration:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  NEXT_TELEMETRY_DISABLED = "1"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  node_bundler = "esbuild"
```

## Troubleshooting

### Build Failures

- **Node version issues**: Ensure Node 20 is specified in netlify.toml
- **Environment variables**: Verify all required variables are set in Netlify dashboard
- **Dependency issues**: Check that `npm install` runs successfully locally

### Runtime Issues

- **Supabase connection**: Verify your Supabase URL and keys are correct
- **Authentication**: Check that Supabase Auth is properly configured
- **Database access**: Ensure RLS policies are set up correctly

## Post-Deployment Checklist

- [ ] Test the login functionality with a Supabase user
- [ ] Verify client dashboard loads correctly
- [ ] Check that proposal pages render with MDX content
- [ ] Test the approval button functionality
- [ ] Verify job sheet generation works (if needed locally)

## Custom Domain (Optional)

To use a custom domain:

1. In Netlify dashboard, go to **Domain Settings**
2. Click "Add custom domain"
3. Enter your domain name
4. Follow the DNS configuration instructions provided

## Continuous Deployment

With Git-based deployment, Netlify will automatically rebuild and deploy when you push changes to your repository. This makes it easy to:
- Add new client proposals
- Update catalog items
- Modify templates
- Fix bugs and add features
