"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { createProduct, updateProduct } from "@/app/actions/products"
import { useToast } from "@/hooks/use-toast"
import { ProductImages } from "./product-images"
import { CheckCircle2, XCircle } from "lucide-react"

const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category_id: z.string().uuid("Please select a category"),
  description: z.string().nullable().default("").transform(v => v || ""),
  internal_notes: z.string().nullable().default("").transform(v => v || ""),
  upc: z.string().nullable().default("").transform(v => v || ""),
  aliases: z.union([
    z.string(),
    z.array(z.string())
  ]).optional().transform(val => {
    if (Array.isArray(val)) return val.join(", ");
    return val || "";
  }),
})

type ProductFormValues = z.infer<typeof productSchema>

interface Category {
  id: string
  name: string
}

interface EnhancedProductFormProps {
  categories: Category[]
  initialData?: ProductFormValues & { 
    id: string
    aliases?: string[]
  }
  existingImages?: {
    id: string
    url: string
    type: 'product' | 'upc'
    main: boolean
  }[]
  onSuccess?: () => void
}

export function EnhancedProductForm({ 
  categories, 
  initialData, 
  existingImages = [],
  onSuccess 
}: EnhancedProductFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || "",
      category_id: initialData?.category_id || "",
      upc: initialData?.upc || "",
      description: initialData?.description || "",
      internal_notes: initialData?.internal_notes || "",
      aliases: Array.isArray(initialData?.aliases) 
        ? initialData.aliases.join(", ")
        : initialData?.aliases || "",
    },
  })

  async function onSubmit(data: ProductFormValues) {
    setIsLoading(true)
    try {
      const formData = {
        ...data,
        aliases: data.aliases && data.aliases.trim() !== '' 
          ? data.aliases.split(",").map(alias => alias.trim())
          : [],
      }

      const result = initialData
        ? await updateProduct(initialData.id, formData)
        : await createProduct(formData)

      if (!result.success) {
        throw new Error(result.error)
      }

      toast({
        title: initialData ? "Success" : "Product Created",
        description: (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-green-600">
                {initialData 
                  ? `${data.name} has been updated successfully.`
                  : `${data.name} has been created successfully.`
                }
              </span>
            </div>
          </div>
        ),
        variant: "default",
        className: "border-2 border-green-500/20 bg-green-50 dark:bg-green-900/10",
      })

      if (onSuccess) {
        onSuccess()
      } else {
        router.refresh()
        if (!initialData) {
          router.push('/dashboard/products')
        }
      }
    } catch (error) {
      console.error("Error saving product:", error)
      toast({
        title: "Error",
        description: (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-red-600">
                {error instanceof Error 
                  ? error.message 
                  : "Failed to save product. Please try again."
                }
              </span>
            </div>
          </div>
        ),
        variant: "destructive",
        className: "border-2 border-red-500/20 bg-red-50 dark:bg-red-900/10",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Product name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="upc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UPC</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Product UPC" 
                    {...field} 
                    value={field.value || ""} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Product description"
                    className="resize-none"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="aliases"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aliases</FormLabel>
                <FormControl>
                  <Input placeholder="Comma-separated list of aliases" {...field} />
                </FormControl>
                <FormDescription>
                  Alternative names used by different retailers
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="internal_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Internal Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Internal notes about the product"
                    className="resize-none"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : initialData ? "Update Product" : "Create Product"}
          </Button>
        </form>
      </Form>

      {initialData && (
        <div className="border-t pt-6 space-y-6">
          <ProductImages 
            productId={initialData.id}
            existingImages={existingImages}
            onImagesUpdated={onSuccess}
          />
        </div>
      )}
    </div>
  )
}