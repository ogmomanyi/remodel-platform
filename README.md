# Kota Designs - Renovation Presentation Platform

A Git-Driven Renovation Presentation Platform for managing design ideas, client proposals, and project approvals. Built with Next.js, Supabase, and MDX for a professional, version-controlled workflow.

## Features

- **Git-Driven Content Management**: All proposals, materials, and specifications stored as Markdown/MDX files
- **Client Portal**: Secure, authenticated dashboard for clients to view and approve proposals
- **Digital Approvals**: Clients can digitally sign off on proposals with database-backed tracking
- **Material Catalog**: Reusable specifications for flooring, carpentry, and other renovation materials
- **Job Sheet Generation**: Automated creation of carpenter work instructions from proposal data
- **Professional Presentations**: Rich MDX content with interactive components

## Tech Stack

- **Next.js 16** with TypeScript and Tailwind CSS
- **Supabase** for authentication and database
- **MDX** for rich content authoring
- **Netlify** for deployment

## Getting Started

### Prerequisites

1. Node.js 20 or higher
2. A Supabase project (free tier works)
3. Git for version control

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ogmomanyi/remodel-platform.git
cd remodel-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup

Follow the [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) guide to:
- Create the `project_approvals` table
- Set up Row Level Security policies
- Add user accounts for your clients

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Usage

### Creating a New Client Proposal

1. Create a new directory in `src/content/projects/[client-name]/`
2. Add a `proposal.mdx` file with frontmatter:
```yaml
---
client_name: "Client Name"
project_code: "PRJ-2026-001"
allowed_emails: ["client@example.com"]
status: "pending-approval"
materials_required:
- Material 1
- Material 2
carpentry_labor_hours: 24
---
```

3. Add your proposal content using Markdown and custom components

### Adding Material Specifications

Add catalog items to `src/content/catalog/[category]/[item].md`

### Generating Job Sheets

```bash
npm run generate:job-sheet [client-name]
```

## Deployment

Deploy to Netlify following the [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) guide.

## Project Structure

```
├── src/
│   ├── app/                    # Next.js app router
│   ├── components/             # React components
│   ├── content/                # MDX content
│   │   ├── catalog/           # Material specifications
│   │   └── projects/          # Client proposals
│   ├── scripts/               # Utility scripts
│   └── utils/                 # Helper functions
├── public/                    # Static assets
└── documentation files       # Setup guides
```

## License

Proprietary - Kota Designs

## Support

For support and documentation, refer to the setup guides in the repository root.
