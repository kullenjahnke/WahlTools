import { createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import * as fs from 'fs'
import * as path from 'path'

async function exportDataBackup() {
  console.log('Starting data export backup...')
  
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  
  const backup: any = {
    timestamp: new Date().toISOString(),
    tables: {}
  }

  // Export all tables
  const tables = [
    'products',
    'product_categories', 
    'product_urls',
    'product_images',
    'prices',
    'price_change_logs',
    'price_check_logs',
    'competitors',
    'competitor_products',
    'competitor_product_urls',
    'competitor_prices'
  ]

  for (const table of tables) {
    console.log(`Exporting ${table}...`)
    const { data, error } = await supabase
      .from(table)
      .select('*')
    
    if (error) {
      console.error(`Error exporting ${table}:`, error)
    } else {
      backup.tables[table] = data
      console.log(`Exported ${data?.length || 0} records from ${table}`)
    }
  }

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup_${timestamp}.json`
  const filepath = path.join(process.cwd(), 'backups', filename)
  
  // Create backups directory if it doesn't exist
  const backupsDir = path.join(process.cwd(), 'backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }
  
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2))
  console.log(`Backup saved to: ${filepath}`)
  
  return backup
}

// Run if called directly
if (require.main === module) {
  exportDataBackup()
    .then(() => console.log('Backup complete!'))
    .catch(console.error)
}

export default exportDataBackup