#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Tables to backup
const TABLES_TO_BACKUP = [
  'products',
  'product_categories',
  'product_images',
  'product_urls',
  'prices',
  'price_change_logs',
  'price_check_logs',
  'competitors',
  'competitor_products',
  'competitor_product_urls',
  'competitor_prices'
]

async function backupTable(tableName: string): Promise<{ tableName: string; data: any[]; count: number }> {
  console.log(`Backing up ${tableName}...`)
  
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: true, nullsFirst: true })

    if (error) {
      console.warn(`Warning: Could not backup ${tableName}: ${error.message}`)
      return { tableName, data: [], count: 0 }
    }

    return { 
      tableName, 
      data: data || [], 
      count: count || data?.length || 0 
    }
  } catch (err) {
    console.warn(`Warning: Could not backup ${tableName}:`, err)
    return { tableName, data: [], count: 0 }
  }
}

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const backupDir = path.join(process.cwd(), 'backups', `backup-${timestamp}`)
  
  // Create backup directory
  await fs.mkdir(backupDir, { recursive: true })
  
  console.log(`\n🔵 Starting database backup...`)
  console.log(`📁 Backup directory: ${backupDir}\n`)
  
  const backupSummary: any = {
    timestamp: new Date().toISOString(),
    tables: {},
    totalRecords: 0
  }
  
  // Backup each table
  for (const table of TABLES_TO_BACKUP) {
    const backup = await backupTable(table)
    
    // Save to individual JSON file
    const filePath = path.join(backupDir, `${table}.json`)
    await fs.writeFile(filePath, JSON.stringify(backup.data, null, 2))
    
    // Update summary
    backupSummary.tables[table] = {
      count: backup.count,
      file: `${table}.json`
    }
    backupSummary.totalRecords += backup.count
    
    console.log(`✅ ${table}: ${backup.count} records`)
  }
  
  // Save backup summary
  const summaryPath = path.join(backupDir, 'backup-summary.json')
  await fs.writeFile(summaryPath, JSON.stringify(backupSummary, null, 2))
  
  // Create restore script
  const restoreScriptPath = path.join(backupDir, 'restore.ts')
  await fs.writeFile(restoreScriptPath, `#!/usr/bin/env ts-node
// Restore script for backup ${timestamp}
// Usage: ts-node restore.ts

import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '../../.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const TABLES = ${JSON.stringify(TABLES_TO_BACKUP, null, 2)}

async function restore() {
  console.log('⚠️  WARNING: This will restore data to your database!')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  for (const table of TABLES) {
    try {
      const data = JSON.parse(await fs.readFile(\`\${table}.json\`, 'utf-8'))
      if (data.length > 0) {
        const { error } = await supabase.from(table).upsert(data)
        if (error) {
          console.error(\`Error restoring \${table}:\`, error)
        } else {
          console.log(\`✅ Restored \${table}: \${data.length} records\`)
        }
      }
    } catch (err) {
      console.warn(\`Skipping \${table}: \`, err.message)
    }
  }
}

restore().catch(console.error)
`)
  
  console.log(`\n✨ Backup completed successfully!`)
  console.log(`📊 Total records backed up: ${backupSummary.totalRecords}`)
  console.log(`📁 Backup location: ${backupDir}`)
  console.log(`📝 Summary file: backup-summary.json`)
  console.log(`🔄 Restore script: restore.ts`)
  
  return backupDir
}

// Run backup
createBackup()
  .then(() => {
    console.log('\n✅ Database backup completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Backup failed:', error)
    process.exit(1)
  })