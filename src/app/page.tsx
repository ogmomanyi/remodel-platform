import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const projectsDir = path.join(process.cwd(), 'src/content/projects');
  const featuredProjects = [];

  // Scan all projects for featured/approved works
  if (fs.existsSync(projectsDir)) {
    const projectFolders = fs.readdirSync(projectsDir);
    for (const folder of projectFolders) {
      const mdxPath = path.join(projectsDir, folder, 'proposal.mdx');
      if (fs.existsSync(mdxPath)) {
        const fileContent = fs.readFileSync(mdxPath, 'utf8');
        const { data: frontmatter } = matter(fileContent);

        // Check database for approval status
        const { data: approvalRecord } = await supabase
          .from('project_approvals')
          .select('*')
          .eq('project_code', frontmatter.project_code)
          .single();

        const isApproved = approvalRecord?.status === 'approved';
        
        // Only show approved projects on homepage
        if (isApproved) {
          featuredProjects.push({
            slug: folder,
            client_name: frontmatter.client_name || folder,
            project_code: frontmatter.project_code || 'N/A',
            status: approvalRecord?.status || frontmatter.status || 'Pending',
          });
        }
      }
    }
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">Kota Designs</h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Transforming spaces through expert renovation and design craftsmanship
          </p>
          <div className="flex gap-4 justify-center">
            <Link 
              href="/client-login" 
              className="bg-white text-slate-900 px-8 py-3 rounded-lg font-semibold hover:bg-slate-100 transition"
            >
              Client Portal
            </Link>
            <Link 
              href="/admin-login" 
              className="bg-slate-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-slate-600 transition border border-slate-600"
            >
              Admin Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Work Section */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Projects</h2>
          <p className="text-slate-600 mb-8">Our recently completed renovation projects</p>
          
          {featuredProjects.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
              <div className="text-slate-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Featured Projects Yet</h3>
              <p className="text-slate-500">Check back soon to see our completed renovation work</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProjects.map((project) => (
                <div key={project.slug} className="bg-slate-50 rounded-lg overflow-hidden border border-slate-200 hover:shadow-lg transition">
                  <div className="h-48 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                    <div className="text-slate-400 text-center">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="text-sm">Project Image</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-1 rounded">
                        {project.project_code}
                      </span>
                      <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded">
                        APPROVED
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{project.client_name}</h3>
                    <p className="text-sm text-slate-600">Completed renovation project</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-slate-50 py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">Our Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Flooring Solutions</h3>
              <p className="text-slate-600">Premium timber decking, porcelain pavers, and custom flooring installations</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Structural Carpentry</h3>
              <p className="text-slate-600">Door installations, wall modifications, and custom carpentry work</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Complete Renovations</h3>
              <p className="text-slate-600">Full-service renovation from design to completion</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-slate-400">© 2026 Kota Designs. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
