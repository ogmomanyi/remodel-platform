import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export type ProjectFrontmatter = {
  client_name?: string
  project_code?: string
  allowed_emails?: unknown
  status?: string
  materials_required?: unknown
  carpentry_labor_hours?: number
  [key: string]: unknown
}

export type Project = {
  slug: string
  proposalPath: string
  client_name: string
  project_code: string
  allowed_emails: string[]
  status: string
  materials_required: string[]
  carpentry_labor_hours: number
  frontmatter: ProjectFrontmatter
  content: string
}

const PROJECTS_DIR = path.join(process.cwd(), 'src/content/projects')
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function normalizeEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((email): email is string => typeof email === 'string')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeMaterials(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseProject(slug: string, filePath: string, fileContent: string): Project {
  const { content, data: frontmatter } = matter(fileContent) as {
    content: string
    data: ProjectFrontmatter
  }

  const clientName = typeof frontmatter.client_name === 'string' ? frontmatter.client_name.trim() : slug
  const projectCode = typeof frontmatter.project_code === 'string' ? frontmatter.project_code.trim() : slug
  const status = typeof frontmatter.status === 'string' ? frontmatter.status.trim() : 'draft'
  const laborHours = typeof frontmatter.carpentry_labor_hours === 'number' ? frontmatter.carpentry_labor_hours : 0

  return {
    slug,
    proposalPath: filePath,
    client_name: clientName || slug,
    project_code: projectCode || slug,
    allowed_emails: normalizeEmails(frontmatter.allowed_emails),
    status: status || 'draft',
    materials_required: normalizeMaterials(frontmatter.materials_required),
    carpentry_labor_hours: laborHours,
    frontmatter,
    content,
  }
}

export function listProjects(): Project[] {
  if (!fs.existsSync(PROJECTS_DIR)) return []

  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && SLUG_PATTERN.test(entry.name))
    .map((entry) => {
      const slug = entry.name
      const proposalPath = path.join(PROJECTS_DIR, slug, 'proposal.mdx')
      if (!fs.existsSync(proposalPath)) return null

      try {
        return parseProject(slug, proposalPath, fs.readFileSync(proposalPath, 'utf8'))
      } catch {
        return null
      }
    })
    .filter((project): project is Project => Boolean(project))
}

export function getProjectBySlug(slug: string): Project | null {
  if (!SLUG_PATTERN.test(slug)) return null
  const project = listProjects().find((item) => item.slug === slug)
  return project ?? null
}

export function getProjectByCode(projectCode: string): Project | null {
  const normalized = projectCode.trim().toLowerCase()
  if (!normalized) return null
  return listProjects().find((item) => item.project_code.toLowerCase() === normalized) ?? null
}

export function userCanAccessProject(project: Project, email?: string | null): boolean {
  const normalizedEmail = email?.trim().toLowerCase()
  if (!normalizedEmail) return false
  return project.allowed_emails.includes(normalizedEmail)
}
