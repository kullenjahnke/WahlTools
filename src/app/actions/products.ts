'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
// ProductInsert and ProductUpdate types imported for reference

interface ProductFormData {
  name: string
  category_id: string
  upc?: string
  description?: string
  internal_notes?: string
  aliases?: string[]
}

export async function createProduct(data: ProductFormData) {
  const supabase = await createSupabaseServerClient()

  try {
    console.log('Creating product:', data)
    
    // Ensure we have a category_id
    if (!data.category_id) {
      throw new Error('Category is required')
    }

    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        name: data.name,
        category_id: data.category_id,
        upc: data.upc || null,
        description: data.description || null,
        internal_notes: data.internal_notes || null,
        aliases: data.aliases || []
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    // Activity logging removed - no longer tracking attribution

    console.log('Product created:', newProduct)
    console.log('Revalidating path: /dashboard/products')
    revalidatePath('/dashboard/products')
    console.log('Path revalidated')

    return { success: true, data: newProduct }
  } catch (error: unknown) {
    console.error('Error creating product:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create product' 
    }
  }
}

export async function updateProduct(id: string, data: ProductFormData) {
  const supabase = await createSupabaseServerClient()

  try {
    console.log('Updating product:', id, data)
    
    if (!data.category_id) {
      throw new Error('Category is required')
    }

    const { error } = await supabase
      .from('products')
      .update({
        name: data.name,
        category_id: data.category_id,
        upc: data.upc || null,
        description: data.description || null,
        internal_notes: data.internal_notes || null,
        aliases: data.aliases || []
      })
      .eq('id', id)

    if (error) throw error

    // Activity logging removed - no longer tracking attribution

    console.log('Product updated')
    console.log('Revalidating path: /dashboard/products')
    revalidatePath('/dashboard/products')
    console.log('Path revalidated')

    return { success: true }
  } catch (error: unknown) {
    console.error('Error updating product:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update product' 
    }
  }
}

export async function deleteProduct(id: string) {
  const supabase = await createSupabaseServerClient()
  
  try {
    console.log('Deleting product:', id)

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) throw error

    console.log('Product deleted')
    console.log('Revalidating path: /dashboard/products')
    revalidatePath('/dashboard/products')
    console.log('Path revalidated')

    return { success: true }
  } catch (error: unknown) {
    console.error('Error deleting product:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete product' 
    }
  }
}