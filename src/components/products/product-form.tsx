"use client"

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
import { Input } from "@/components/ui/input"
import { createClientClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"

const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category: z.string().min(2, "Category must be at least 2 characters"),
  aliases: z.string().optional(),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
  initialData?: {
    id: string
    name: string
    category: string
    aliases: string[]
  }
  onSuccess?: () => void
}

export function ProductForm({ initialData, onSuccess }: ProductFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientClient()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: initialData?.name || "",
      category: initialData?.category || "",
      aliases: initialData?.aliases?.join(", ") || "",
    },
  })

  async function onSubmit(data: ProductFormValues) {
    setIsLoading(true)
    try {
      const aliases = data.aliases
        ? data.aliases.split(",").map(alias => alias.trim())
        : []

      if (initialData) {
        await supabase
          .from("products")
          .update({
            name: data.name,
            category: data.category,
            aliases,
          })
          .eq("id", initialData.id)
      } else {
        await supabase.from("products").insert({
          name: data.name,
          category: data.category,
          aliases,
        })
      }

      router.refresh()
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error("Error saving product:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Input placeholder="Product category" {...field} />
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
              <FormLabel>Aliases (comma-separated)</FormLabel>
              <FormControl>
                <Input placeholder="Alias 1, Alias 2, ..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : initialData ? "Update Product" : "Add Product"}
        </Button>
      </form>
    </Form>
  )
}