// src/components/competitors/competitor-product-form.tsx
"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
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
import { useRouter } from "next/navigation"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { CompetitorProduct } from "@/types/database"
import { Switch } from "../ui/switch"

const competitorProductSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  competitor_id: z.string().uuid("Please select a competitor"),
  category_id: z.string().uuid("Please select a category"),
  related_product_id: z.union([
    z.literal("none"),
    z.string().uuid()
  ]).optional(),
  weight_oz: z.string().optional(),
  is_active: z.boolean().default(true),
})

// Type for the form
type CompetitorProductFormValues = z.infer<typeof competitorProductSchema>;

// Function to process form data before submission
const processFormData = (data: CompetitorProductFormValues) => {
  return {
    ...data,
    weight_oz: data.weight_oz && data.weight_oz !== '' ? parseFloat(data.weight_oz) : null,
  };
};

interface CompetitorProductFormProps {
  initialData?: CompetitorProduct
  competitors: {
    id: string
    name: string
  }[]
  categories: {
    id: string
    name: string
  }[]
  products: {
    id: string
    name: string
    category_id: string
  }[]
}

export function CompetitorProductForm({ 
  initialData,
  competitors,
  categories,
  products 
}: CompetitorProductFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()

  const form = useForm<z.infer<typeof competitorProductSchema>>({
    resolver: zodResolver(competitorProductSchema),
    defaultValues: {
      name: initialData?.name || "",
      competitor_id: initialData?.competitor_id || "",
      category_id: initialData?.category_id || "",
      related_product_id: initialData?.related_product_id || "none",
      weight_oz: initialData?.weight_oz ? String(initialData.weight_oz) : "",
      is_active: initialData?.is_active ?? true,
    },
  })

  // Watch the category_id to filter related products
  const categoryId = form.watch("category_id")
  
  // Filter products by category
  const filteredProducts = categoryId
    ? products.filter(product => product.category_id === categoryId)
    : products

  async function onSubmit(data: CompetitorProductFormValues) {
    setIsLoading(true)
    try {
      // Process the form data to convert weight_oz from string to number/null
      const processedData = processFormData(data);
      
      // Transform the 'none' value to null for related_product_id
      const formData = {
        ...processedData,
        related_product_id: processedData.related_product_id === 'none' ? null : processedData.related_product_id
      };
      
      if (initialData) {
        // Update existing competitor product
        const { error } = await supabase
          .from('competitor_products')
          .update({
            name: formData.name,
            competitor_id: formData.competitor_id,
            category_id: formData.category_id,
            related_product_id: formData.related_product_id,
            weight_oz: formData.weight_oz,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Competitor product updated successfully",
        })
      } else {
        // Create new competitor product
        const { error } = await supabase
          .from('competitor_products')
          .insert({
            name: formData.name,
            competitor_id: formData.competitor_id,
            category_id: formData.category_id,
            related_product_id: formData.related_product_id,
            weight_oz: formData.weight_oz,
            is_active: formData.is_active,
          })

        if (error) throw error

        toast({
            title: "Success",
            description: "Competitor product created successfully",
          })
        }
  
        router.push('/dashboard/competitors/products')
        router.refresh()
      } catch (error) {
        console.error('Error saving competitor product:', error)
        toast({
          title: "Error",
          description: "Failed to save competitor product. Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
  
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name</FormLabel>
                <FormControl>
                  <Input placeholder="Competitor product name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
  
          <FormField
            control={form.control}
            name="competitor_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Competitor</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a competitor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {competitors.map((competitor) => (
                      <SelectItem key={competitor.id} value={competitor.id}>
                        {competitor.name}
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
            name="related_product_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Related Wahlburgers Product</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  disabled={!categoryId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={
                        categoryId 
                          ? "Select a related product" 
                          : "Select a category first"
                      } />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categoryId && (
                      <>
                        <SelectItem value="none">None</SelectItem>
                        {filteredProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
  
          <FormField
            control={form.control}
            name="weight_oz"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (oz)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="Product weight in ounces" 
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
  
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active Status</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Inactive products will not appear in comparison reports
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
  
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : initialData ? "Update Product" : "Create Product"}
          </Button>
        </form>
      </Form>
    )
  }