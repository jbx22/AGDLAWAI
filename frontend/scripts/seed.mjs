#!/usr/bin/env node
/**
 * JBL BIZ LAW — Database Seed Script
 * 
 * Seeds the database with default system data (workflows, etc.)
 * after migrations have been applied.
 * 
 * Usage:  node scripts/seed.mjs
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = join(__dirname, '..');
const ENV_FILE = join(FRONTEND_DIR, '.env.local');

// Load DATABASE_URL from .env.local
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL && existsSync(ENV_FILE)) {
  const content = readFileSync(ENV_FILE, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) { DATABASE_URL = m[1]; break; }
  }
}

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Create .env.local or set envar.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// Inline the schema types we need for seeding
// (avoids full import of schema.ts which needs ts-node/bundler)

const SYSTEM_WORKFLOWS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: null,
    title: 'Document Review',
    type: 'document_review',
    prompt_md: `Analyze the attached document and provide:
1. **Summary** — key points and structure
2. **Risk Assessment** — identify potential legal risks
3. **Recommendations** — suggested actions

Please cite specific clauses and page numbers where applicable.`,
    columns_config: null,
    practice: null,
    is_system: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    user_id: null,
    title: 'Contract Analysis',
    type: 'contract_analysis',
    prompt_md: `Review this contract and identify:
1. **Key Terms** — payment terms, duration, termination clauses
2. **Obligations** — what each party must do
3. **Liabilities & Indemnities** — who bears what risk
4. **Missing Clauses** — common provisions that are absent
5. **Favorable/Unfavorable** — which party benefits more

Flag any unusual or one-sided provisions.`,
    columns_config: null,
    practice: null,
    is_system: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    user_id: null,
    title: 'Compliance Check',
    type: 'compliance_check',
    prompt_md: `Evaluate this document for compliance with applicable regulations:
1. **Regulatory References** — identify relevant laws/regulations
2. **Compliance Gaps** — where the document falls short
3. **Required Changes** — what must be modified
4. **Timeline** — deadlines or effective dates mentioned

Prioritize findings by severity: Critical / High / Medium / Low.`,
    columns_config: null,
    practice: null,
    is_system: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    user_id: null,
    title: 'Due Diligence',
    type: 'due_diligence',
    prompt_md: `Perform due diligence review of the attached document(s):
1. **Entity Overview** — company structure, ownership
2. **Financial Health** — key financial indicators
3. **Legal Status** — pending litigation, regulatory actions
4. **Material Contracts** — significant agreements
5. **IP Assessment** — intellectual property status

Create a structured report with findings organized by category.`,
    columns_config: JSON.stringify([
      { key: 'category', label: 'Category' },
      { key: 'finding', label: 'Finding' },
      { key: 'risk_level', label: 'Risk Level' },
      { key: 'recommendation', label: 'Recommendation' },
    ]),
    practice: 'corporate',
    is_system: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    user_id: null,
    title: 'Litigation Document Analysis',
    type: 'litigation_analysis',
    prompt_md: `Analyze this litigation document:
1. **Case Summary** — parties, jurisdiction, claims
2. **Key Arguments** — plaintiff and defendant positions
3. **Evidence Analysis** — strength of cited evidence
4. **Procedural Status** — current stage and next steps
5. **Settlement Assessment** — likelihood and range

Provide a structured legal memorandum format.`,
    columns_config: null,
    practice: 'litigation',
    is_system: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    user_id: null,
    title: 'Arabic Legal Translation',
    type: 'arabic_translation',
    prompt_md: `Provide a comprehensive bilingual analysis:
1. **Arabic Translation** — accurate legal translation of key sections
2. **English Summary** — plain-English explanation
3. **Legal Equivalence** — note where Arabic/French law concepts differ from common law
4. **Jurisdiction Notes** — relevant court or regulatory body

Be precise with legal terminology in both languages.`,
    columns_config: null,
    practice: 'general',
    is_system: true,
  },
];

const DEMO_ACCOUNTS = [
  {
    email: 'demo@jblbizlaw.com',
    password: 'DemoUser123!',
    displayName: 'JBL Demo User',
    organisation: 'JBL Demo',
    role: 'user',
    tier: 'Professional',
  },
  {
    email: 'admin@jblbizlaw.com',
    password: 'AdminDemo123!',
    displayName: 'JBL Demo Admin',
    organisation: 'JBL Demo',
    role: 'admin',
    tier: 'Business',
  },
  {
    email: 'superadmin@jblbizlaw.com',
    password: 'SuperAdminDemo123!',
    displayName: 'JBL Demo Super Admin',
    organisation: 'JBL Demo',
    role: 'super_admin',
    tier: 'Enterprise',
  },
];

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   JBL BIZ LAW — Database Seeding        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`📡 Connecting to Neon...`);
  
  // Seed system workflows via raw SQL (avoids schema import complexity)
  for (const wf of SYSTEM_WORKFLOWS) {
    try {
      await sql`
        INSERT INTO workflows (id, user_id, title, type, prompt_md, columns_config, practice, is_system)
        VALUES (${wf.id}, ${wf.user_id}, ${wf.title}, ${wf.type}, ${wf.prompt_md}, 
                ${wf.columns_config}::jsonb, 
                ${wf.practice}, ${wf.is_system})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          type = EXCLUDED.type,
          prompt_md = EXCLUDED.prompt_md,
          columns_config = EXCLUDED.columns_config,
          practice = EXCLUDED.practice
      `;
      console.log(`  ✅ ${wf.title}`);
    } catch (err) {
      if (err.message?.includes('relation "workflows" does not exist')) {
        console.error('\n❌ Tables not found. Run migrations first: npm run db:push');
        process.exit(1);
      }
      console.log(`  ⚠️  ${wf.title}: ${err.message}`);
    }
  }

  console.log('\nSeeding demo accounts...');
  for (const account of DEMO_ACCOUNTS) {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(account.password, salt);

    try {
      const [user] = await sql`
        INSERT INTO users (email, password_hash, password_salt, display_name)
        VALUES (${account.email}, ${passwordHash}, ${salt}, ${account.displayName})
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          password_salt = EXCLUDED.password_salt,
          display_name = EXCLUDED.display_name,
          updated_at = NOW()
        RETURNING id
      `;

      await sql`
        INSERT INTO user_profiles (
          user_id,
          display_name,
          organisation,
          role,
          tier,
          account_status,
          tabular_model
        )
        VALUES (
          ${user.id},
          ${account.displayName},
          ${account.organisation},
          ${account.role},
          ${account.tier},
          'active',
          'deepseek-v4-flash'
        )
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          organisation = EXCLUDED.organisation,
          role = EXCLUDED.role,
          tier = EXCLUDED.tier,
          account_status = 'active',
          tabular_model = EXCLUDED.tabular_model,
          updated_at = NOW()
      `;
      console.log(`  demo account: ${account.email} (${account.role})`);
    } catch (err) {
      console.log(`  demo account ${account.email}: ${err.message}`);
    }
  }

  console.log('\n✅ Seeding complete!');
  console.log(`   ${SYSTEM_WORKFLOWS.length} system workflows inserted.`);
  console.log(`   ${DEMO_ACCOUNTS.length} demo accounts inserted or updated.`);
  console.log('\nNext steps:');
  console.log('  Run the dev server:  npm run dev');
}

main().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  process.exit(1);
});
