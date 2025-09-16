"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Upload, X, Camera } from "lucide-react"
import Image from "next/image"
import { uploadProductImage, deleteProductImage, setMainImage } from "@/app/actions/images"

interface ProductImagesProps {
  productId: string
  existingImages?: {
    id: string
    url: string
    type: 'product' | 'upc'
    main: boolean
  }[]
  onImagesUpdated?: () => void
}

export function ProductImages({ productId, existingImages = [], onImagesUpdated }: ProductImagesProps) {
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'upc') => {
    const file = event.target.files?.[0]
    if (!file) return

    const maxSize = 4 * 1024 * 1024 // 4MB
    if (file.size > maxSize) {
      toast({
        title: "Error",
        description: "Image must be smaller than 4MB",
        variant: "destructive",
      })
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Only JPEG, PNG and WebP images are allowed",
        variant: "destructive"
      })
      return
    }

    setIsUploading(true)
    try {
      const result = await uploadProductImage(productId, file, type)

      if (!result.success) {
        throw new Error(result.error || 'Failed to upload image')
      }

      toast({
        title: "Image Uploaded",
        description: "Image has been uploaded successfully.",
        variant: "default",
      })

      if (onImagesUpdated) {
        onImagesUpdated()
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      toast({
        title: "Error",
        description: error instanceof Error 
          ? error.message 
          : "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const handleDelete = async (imageId: string, url: string) => {
    try {
      const result = await deleteProductImage(imageId, url)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Image Deleted",
        description: "Image has been removed successfully.",
        variant: "default",
      })

      if (onImagesUpdated) {
        onImagesUpdated()
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      toast({
        title: "Error",
        description: "Failed to delete image. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSetMainImage = async (imageId: string) => {
    try {
      const result = await setMainImage(imageId, productId)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: "Main Image Updated",
        description: "Main product image has been updated successfully.",
        variant: "default",
      })

      if (onImagesUpdated) {
        onImagesUpdated()
      }
    } catch (error) {
      console.error('Error updating main image:', error)
      toast({
        title: "Error",
        description: "Failed to update main image. Please try again.",
        variant: "destructive",
      })
    }
  }

  const productImages = existingImages.filter(img => img.type === 'product')
  const upcImage = existingImages.find(img => img.type === 'upc')

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Product Images</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productImages.map((image) => (
            <Card key={image.id} className="relative group">
              <CardContent className="p-2">
                <div className="aspect-square relative rounded-lg overflow-hidden">
                  <Image
                    src={image.url}
                    alt="Product image"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!image.main && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSetMainImage(image.id)}
                      >
                        Set as Main
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(image.id, image.url)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {image.main && (
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                      Main
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="p-2">
              <div className="aspect-square relative rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors">
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <Camera className="h-8 w-8 mb-2 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Add Image</span>
                      <span className="text-xs text-muted-foreground mt-1">Max size: 4MB</span>
                      <span className="text-xs text-muted-foreground">JPEG, PNG, WebP</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileUpload(e, 'product')}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">UPC Barcode Image</h3>
        {upcImage ? (
          <Card className="relative group max-w-md">
            <CardContent className="p-2">
              <div className="aspect-video relative rounded-lg overflow-hidden">
                <Image
                  src={upcImage.url}
                  alt="UPC barcode"
                  fill
                  className="object-contain"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(upcImage.id, upcImage.url)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-md">
            <CardContent className="p-2">
              <div className="aspect-video relative rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors">
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Upload UPC Image</span>
                      <span className="text-xs text-muted-foreground mt-1">Max size: 4MB</span>
                      <span className="text-xs text-muted-foreground">JPEG, PNG, WebP</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileUpload(e, 'upc')}
                    disabled={isUploading}
                  />
                </label>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}