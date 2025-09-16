'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function uploadProductImage(productId: string, file: File, type: 'product' | 'upc') {
  const supabase = await createSupabaseServerClient()

  try {
    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${productId}/${Date.now()}.${fileExt}`
    
    console.log('Starting upload to storage:', { fileName, fileSize: file.size, fileType: file.type })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload to storage failed:', uploadError)
      throw uploadError
    }

    console.log('Upload to storage successful:', { fileName, uploadData })

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    console.log('Generated public URL:', publicUrl)

    // Check if this is the first product image (should be main)
    const { data: existingImages } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .eq('type', 'product')

    const isFirstProductImage = type === 'product' && (!existingImages || existingImages.length === 0)
    console.log('Checking existing images:', { existingImagesCount: existingImages?.length, isFirstProductImage })

    // Save image record
    const { error: dbError } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        url: publicUrl,
        type,
        main: isFirstProductImage
      })

    if (dbError) {
      console.error('Database insert failed:', dbError)
      throw dbError
    }

    console.log('Image record created successfully:', { productId, type, isMain: isFirstProductImage })

    revalidatePath(`/dashboard/products/${productId}`)
    return { success: true }
  } catch (error) {
    console.error('Error uploading image:', error)
    return { success: false, error: 'Failed to upload image' }
  }
}

export async function deleteProductImage(imageId: string, url: string) {
  const supabase = await createSupabaseServerClient()

  try {
    // Get product ID for revalidation
    const { data: image } = await supabase
      .from('product_images')
      .select('product_id')
      .eq('id', imageId)
      .single()

    // Delete from Storage
    const filePath = url.split('/').pop()
    if (filePath) {
      await supabase.storage
        .from('product-images')
        .remove([filePath])
    }

    // Delete from database
    const { error } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId)

    if (error) throw error

    if (image?.product_id) {
      revalidatePath(`/dashboard/products/${image.product_id}`)
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting image:', error)
    return { success: false, error: 'Failed to delete image' }
  }
}

export async function setMainImage(imageId: string, productId: string) {
  const supabase = await createSupabaseServerClient()

  try {
    // Reset all product images to non-main
    await supabase
      .from('product_images')
      .update({ main: false })
      .eq('product_id', productId)
      .eq('type', 'product')

    // Set selected image as main
    const { error } = await supabase
      .from('product_images')
      .update({ main: true })
      .eq('id', imageId)

    if (error) throw error

    revalidatePath(`/dashboard/products/${productId}`)
    return { success: true }
  } catch (error) {
    console.error('Error setting main image:', error)
    return { success: false, error: 'Failed to set main image' }
  }
}