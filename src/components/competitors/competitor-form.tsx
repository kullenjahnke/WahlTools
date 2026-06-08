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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Competitor } from "@/types/database"

const competitorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
})

interface CompetitorFormProps {
  initialData?: Competitor
}

export function CompetitorForm({ initialData }: CompetitorFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()

  const form = useForm<z.infer<typeof competitorSchema>>({
    resolver: zodResolver(competitorSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
    },
  })

  async function onSubmit(data: z.infer<typeof competitorSchema>) {
    setIsLoading(true)
    try {
      if (initialData) {
        // Update existing competitor
        const { error } = await supabase
          .from('competitors')
          .update({
            name: data.name,
            description: data.description,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id)

        if (error) throw error

        toast({
          icon: <CheckCircle2 className="size-5 text-brand" />,
          title: "Success",
          description: "Competitor updated successfully",
        })
      } else {
        // Create new competitor
        const { error } = await supabase
          .from('competitors')
          .insert({
            name: data.name,
            description: data.description,
          })

        if (error) throw error

        toast({
          icon: <CheckCircle2 className="size-5 text-brand" />,
          title: "Success",
          description: "Competitor created successfully",
        })
      }

      router.push('/dashboard/competitors')
      router.refresh()
    } catch (error) {
      console.error('Error saving competitor:', error)
      toast({
        icon: <AlertTriangle className="size-5" />,
        title: "Error",
        description: "Failed to save competitor. Please try again.",
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
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Competitor name" {...field} />
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
                  placeholder="Description of the competitor"
                  className="min-h-24 resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : initialData ? "Update Competitor" : "Create Competitor"}
        </Button>
      </form>
    </Form>
  )
}