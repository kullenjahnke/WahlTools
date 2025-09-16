#!/usr/bin/env ts-node
// Restore script for backup 2025-09-10T15-37-09
// Usage: ts-node restore.ts

import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: '../../.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const TABLES = [
  "products",
  "product_categories",
  "product_images",
  "product_urls",
  "prices",
  "price_change_logs",
  "price_check_logs",
  "competitors",
  "competitor_products",
  "competitor_product_urls",
  "competitor_prices"
]

async function restore() {
  console.log('⚠️  WARNING: This will restore data to your database!')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  for (const table of TABLES) {
    try {
      const data = JSON.parse(await fs.readFile(`${table}.json`, 'utf-8'))
      if (data.length > 0) {
        const { error } = await supabase.from(table).upsert(data)
        if (error) {
          console.error(`Error restoring ${table}:`, error)
        } else {
          console.log(`✅ Restored ${table}: ${data.length} records`)
        }
      }
    } catch (err) {
      console.warn(`Skipping ${table}: `, err.message)
    }
  }
}

restore().catch(console.error)
