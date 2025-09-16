"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Edit, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"

interface ProductDetailViewProps {
  product: {
    id: string
    name: string
    sku: string
    category: string
    upc?: string
    description?: string
    internal_notes?: string
    aliases?: string[]
  }
  images: {
    id: string
    url: string
    type: 'product' | 'upc'
    main: boolean
  }[]
}

export function ProductDetailView({ product, images }: ProductDetailViewProps) {
  const router = useRouter()
  
  const mainImage = images.find(img => img.type === 'product' && img.main)
  const productImages = images.filter(img => img.type === 'product' && !img.main)
  const upcImage = images.find(img => img.type === 'upc')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => router.push(`/dashboard/products/${product.id}/edit`)}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit Product
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium">Name</h3>
                <p>{product.name}</p>
              </div>
              <div>
                <h3 className="font-medium">SKU</h3>
                <p>{product.sku}</p>
              </div>
              <div>
                <h3 className="font-medium">Category</h3>
                <p>{product.category}</p>
              </div>
              {product.upc && (
                <div>
                  <h3 className="font-medium">UPC</h3>
                  <p>{product.upc}</p>
                </div>
              )}
              {product.description && (
                <div>
                  <h3 className="font-medium">Description</h3>
                  <p className="whitespace-pre-wrap">{product.description}</p>
                </div>
              )}
              {product.aliases && product.aliases.length > 0 && (
                <div>
                  <h3 className="font-medium">Aliases</h3>
                  <p>{product.aliases.join(", ")}</p>
                </div>
              )}
              {product.internal_notes && (
                <div>
                  <h3 className="font-medium">Internal Notes</h3>
                  <p className="whitespace-pre-wrap">{product.internal_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {mainImage && (
            <Card>
              <CardHeader>
                <CardTitle>Main Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square relative rounded-lg overflow-hidden">
                  <Image
                    src={mainImage.url}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {productImages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Additional Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {productImages.map((image) => (
                    <div 
                      key={image.id}
                      className="aspect-square relative rounded-lg overflow-hidden"
                    >
                      <Image
                        src={image.url}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {upcImage && (
            <Card>
              <CardHeader>
                <CardTitle>UPC Barcode</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video relative rounded-lg overflow-hidden">
                  <Image
                    src={upcImage.url}
                    alt="UPC Barcode"
                    fill
                    className="object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}