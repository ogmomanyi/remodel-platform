const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const clientDir = process.argv[2];

if (!clientDir) {
  console.error('Please provide a client directory name.');
  process.exit(1);
}

const filePath = path.join(__dirname, '../content/projects', clientDir, 'proposal.mdx');

if (!fs.existsSync(filePath)) {
  console.error(`Proposal file not found: ${filePath}`);
  process.exit(1);
}

const { data } = matter(fs.readFileSync(filePath, 'utf8'));

const jobSheet = `
======================================
SUBCONTRACTOR JOB SHEET
======================================
Project: ${data.project_code}
Client: ${data.client_name}
Estimated Labor Hours: ${data.carpentry_labor_hours}

MATERIALS TO SOURCE/LOAD:
${data.materials_required.map(m => `- ${m}`).join('\n')}

INSTRUCTIONS:
Execute structural build per attached diagrams. Verify lintel load bearing before cutting east wall.
Follow all specifications from catalog items referenced in the proposal.

======================================
Generated: ${new Date().toISOString()}
======================================
`;

const outPath = path.join(__dirname, '../content/projects', clientDir, 'job-sheet.txt');
fs.writeFileSync(outPath, jobSheet);

console.log(`Job sheet created at ${outPath}`);
