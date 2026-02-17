// src/components/products/retailer-associations.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { RETAILERS } from "@/lib/config/retailers"
import { createClientClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface RetailerAssociationsProps {
  productId: string;
  initialSkus: {
    retailer: string;
    sku: string;
  }[];
  initialUrls: {
    retailer: string;
    url: string;
  }[];
}

export function RetailerAssociations({ 
  productId, 
  initialSkus = [], 
  initialUrls = []
}: RetailerAssociationsProps) {
  const [skus, setSkus] = useState<Record<string, string>>(
    initialSkus.reduce((acc, { retailer, sku }) => ({
      ...acc,
      [retailer]: sku
    }), {})
  );
  
  const [urls, setUrls] = useState<Record<string, string>>(
    initialUrls.reduce((acc, { retailer, url }) => ({
      ...acc,
      [retailer]: url
    }), {})
  );

  const [isEnabled, setIsEnabled] = useState<Record<string, boolean>>(
    RETAILERS.reduce((acc, retailer) => ({
      ...acc,
      [retailer]: initialSkus.some(s => s.retailer === retailer) || 
                  initialUrls.some(u => u.retailer === retailer)
    }), {})
  );

  const { toast } = useToast();
  const router = useRouter();

  const handleSave = async () => {
    try {
      const supabase = createClientClient()
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        throw new Error('Not authenticated')
      }

      // Don't delete existing data if there's nothing new to save
      const urlsToUpdate = Object.entries(urls)
        .filter(([retailer, url]) => isEnabled[retailer] && url.trim())
        .map(([retailer, url]) => ({
          product_id: productId,
          retailer,
          url: url.trim()
        }));

      const skusToUpdate = Object.entries(skus)
        .filter(([retailer, sku]) => isEnabled[retailer] && sku.trim())
        .map(([retailer, sku]) => ({
          product_id: productId,
          retailer,
          sku: sku.trim()
        }));

      // Only proceed with updates if we have data to update
      if (urlsToUpdate.length > 0 || skusToUpdate.length > 0) {
        const { error: deleteUrlsError } = await supabase
          .from('product_urls')
          .delete()
          .eq('product_id', productId);

        if (deleteUrlsError) {
          console.error('Error deleting URLs:', deleteUrlsError);
          throw new Error('Failed to update retailer URLs');
        }

        if (urlsToUpdate.length > 0) {
          const { error: insertUrlsError } = await supabase
            .from('product_urls')
            .insert(urlsToUpdate);

          if (insertUrlsError) {
            console.error('Error inserting URLs:', insertUrlsError);
            throw new Error('Failed to save retailer URLs');
          }
        }

        const { error: deleteSkusError } = await supabase
          .from('retailer_skus')
          .delete()
          .eq('product_id', productId);

        if (deleteSkusError) {
          console.error('Error deleting SKUs:', deleteSkusError);
          throw new Error('Failed to update retailer SKUs');
        }

        if (skusToUpdate.length > 0) {
          const { error: insertSkusError } = await supabase
            .from('retailer_skus')
            .insert(skusToUpdate);

          if (insertSkusError) {
            console.error('Error inserting SKUs:', insertSkusError);
            throw new Error('Failed to save retailer SKUs');
          }
        }
      }

      toast({
        title: "Success",
        description: "Retailer associations updated successfully"
      });

      router.refresh();
    } catch (error) {
      console.error('Error saving retailer associations:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update retailer associations",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retailer Associations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {RETAILERS.map(retailer => (
            <div key={retailer} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{retailer}</span>
                <Switch
                  checked={isEnabled[retailer]}
                  onCheckedChange={(checked) => 
                    setIsEnabled(prev => ({
                      ...prev,
                      [retailer]: checked
                    }))
                  }
                />
              </div>
              {isEnabled[retailer] && (
                <div className="space-y-2 pl-4">
                  <div className="grid gap-2">
                    <Input
                      placeholder="SKU"
                      value={skus[retailer] || ''}
                      onChange={(e) => setSkus(prev => ({
                        ...prev,
                        [retailer]: e.target.value
                      }))}
                    />
                    <Input
                      placeholder="Product URL"
                      value={urls[retailer] || ''}
                      onChange={(e) => setUrls(prev => ({
                        ...prev,
                        [retailer]: e.target.value
                      }))}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          <Button onClick={handleSave}>Save Associations</Button>
        </div>
      </CardContent>
    </Card>
  );
}