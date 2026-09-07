# Supabase Database Setup Guide

This guide will help you set up the required database tables and policies in your Supabase project.

## Prerequisites

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Get your project URL and anon key from the Supabase dashboard
3. Add these to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Setup

### 1. Create Project Approvals Table

Run the following SQL in your Supabase SQL Editor (SQL Editor icon in the left sidebar):

```sql
-- Create the project_approvals table
create table project_approvals (
  project_code text primary key,
  status text default 'pending-approval',
  approved_by text,
  approved_at timestamp with time zone
);

-- Enable Row Level Security (RLS)
alter table project_approvals enable row level security;

-- Allow authenticated users to read and update
create policy "Allow authenticated read" on project_approvals 
  for select to authenticated using (true);

create policy "Allow authenticated insert/update" on project_approvals 
  for all to authenticated using (true);
```

### 2. Set Up Authentication

1. Go to Authentication → Users in your Supabase dashboard
2. Add new users for each client you want to give access
3. Set temporary passwords for each user
4. Share the login credentials with your clients

### 3. Update Client Proposals

For each client proposal in `src/content/projects/[client-name]/proposal.mdx`, add the client's email to the `allowed_emails` array in the frontmatter:

```yaml
---
client_name: "Veranda & Interior Remodel"
project_code: "PRJ-2026-004"
allowed_emails: ["client@example.com", "architect@partner.com"]
status: "pending-approval"
---
```

## Testing the Setup

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. You should be redirected to the login page
4. Sign in with one of the user accounts you created in Supabase
5. You should see the client dashboard with projects you have access to

## Troubleshooting

- **Authentication not working**: Ensure your Supabase URL and anon key are correct in `.env.local`
- **Can't see projects**: Make sure your email is added to the `allowed_emails` array in the proposal frontmatter
- **Database errors**: Verify the SQL was executed correctly in the Supabase SQL Editor
