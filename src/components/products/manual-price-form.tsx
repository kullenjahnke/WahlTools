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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClientClient } from "@/lib/supabase/client"
import { useState } from "react"

const priceSchema = z.object({
  retailer: z.string().min(1, "Retailer is required"),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Price must be a positive number",
  }),
})

interface ManualPriceFormProps {
  productId: string
  onSuccess?: () => void
}

export function ManualPriceForm({ productId, onSuccess }: ManualPriceFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClientClient()

  const form = useForm<z.infer<typeof priceSchema>>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      retailer: "",
      price: "",
    },
  })

  async function onSubmit(data: z.infer<typeof priceSchema>) {
    setIsLoading(true)
    try {
      await supabase.from("prices").insert({
        product_id: productId,
        retailer: data.retailer,
        price: Number(data.price),
      })

      form.reset()
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error("Error adding price:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="retailer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Retailer</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a retailer" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Meijer">Meijer</SelectItem>
                  <SelectItem value="Walmart">Walmart</SelectItem>
                  <SelectItem value="Jewel-Osco">Jewel-Osco</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="0.00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Adding..." : "Add Price"}
        </Button>
      </form>
    </Form>
  )
}