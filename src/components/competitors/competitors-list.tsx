// src/components/competitors/competitors-list.tsx
"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClientClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Edit, Trash2, Search, Box } from "lucide-react"
import { format } from "date-fns"
import { Competitor } from "@/types/database"

interface CompetitorsListProps {
  competitors: Competitor[]
}

export function CompetitorsList({ competitors }: CompetitorsListProps) {
  const [search, setSearch] = useState("")
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClientClient()

  const filteredCompetitors = competitors.filter(competitor =>
    competitor.name.toLowerCase().includes(search.toLowerCase()) ||
    competitor.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleDelete = async (id: string, name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${name}? This will also delete all associated products and prices.`)
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('competitors')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: "Success",
        description: `${name} has been deleted`
      })

      router.refresh()
    } catch (error) {
      console.error('Error deleting competitor:', error)
      toast({
        title: "Error",
        description: "Failed to delete competitor",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search competitors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompetitors.map((competitor) => (
                <TableRow key={competitor.id}>
                  <TableCell className="font-medium">{competitor.name}</TableCell>
                  <TableCell>{competitor.description || 'No description'}</TableCell>
                  <TableCell>{format(new Date(competitor.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/competitors/${competitor.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(competitor.id, competitor.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCompetitors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Box className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2" />
                    <p className="text-muted-foreground">No competitors found</p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={() => router.push('/dashboard/competitors/new')}
                    >
                      Add your first competitor
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}