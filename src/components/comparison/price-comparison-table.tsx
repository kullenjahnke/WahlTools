// src/components/comparison/price-comparison-table.tsx
"use client"

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"
import { format } from "date-fns"
import type { Competitor } from "@/types/database"

// Define proper type interfaces
interface WahlburgersProduct {
  id: string;
  name: string;
  category_id: string;
  category?: string;
  prices?: Array<{
    id: string;
    retailer: string;
    price: number;
    timestamp: string;
    status: string;
    is_promotion?: boolean;
    is_sold_out?: boolean;
  }>;
}

interface CompetitorProduct {
  id: string;
  name: string;
  competitor_id: string;
  related_product_id?: string | null;
  competitor: {
    id: string;
    name: string;
  } | Array<{ id: string; name: string; }>; // Allow either object or array
  competitor_prices?: Array<{
    id: string;
    retailer: string;
    price: number;
    timestamp: string;
    status: string;
    is_promotion?: boolean;
    is_sold_out?: boolean;
  }>;
}

interface PriceComparisonTableProps {
  wahlburgersProducts: WahlburgersProduct[];
  competitorProducts: CompetitorProduct[];
  selectedRetailer: string;
  categoryMap: Map<string, string>;
}

export function PriceComparisonTable({ 
  wahlburgersProducts, 
  competitorProducts,
  selectedRetailer,
  categoryMap
}: PriceComparisonTableProps) {
  // Group competitor products by their related Wahlburgers product
  const competitorsByProduct = competitorProducts.reduce((acc, cp) => {
    if (!cp.related_product_id) return acc;
    
    if (!acc[cp.related_product_id]) {
      acc[cp.related_product_id] = [];
    }
    acc[cp.related_product_id].push(cp);
    return acc;
  }, {} as Record<string, CompetitorProduct[]>);

  // Group products by category
  const productsByCategory = wahlburgersProducts.reduce((acc, product) => {
    const category = categoryMap.get(product.category_id) || 'Uncategorized';
    
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, WahlburgersProduct[]>);

  // Get latest active price - works with both full and partial price types
  const getLatestPrice = (prices?: Array<{
    id: string;
    retailer: string;
    price: number;
    timestamp: string;
    status: string | null;
    is_promotion?: boolean | null;
    is_sold_out?: boolean | null;
  }>) => {
    if (!prices) return undefined;
    return prices
      .filter(p => p.retailer === selectedRetailer && p.status === 'active')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  // Helper function to get competitor name - works with both full and partial types
  const getCompetitorName = (competitor: { id: string; name: string } | Array<{ id: string; name: string }> | Competitor | Competitor[]) => {
    if (Array.isArray(competitor)) {
      return competitor.length > 0 ? competitor[0].name : 'Unknown';
    } else if (competitor && !Array.isArray(competitor)) {
      return competitor.name;
    }
    return 'Unknown';
  };

  return (
    <div className="space-y-8">
      {Object.entries(productsByCategory).map(([category, products]) => (
        <div key={category} className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">{category}</h3>
          
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Wahlburgers Product</TableHead>
                  <TableHead className="text-right w-[150px]">Price</TableHead>
                  <TableHead className="w-[250px]">Competitor Product</TableHead>
                  <TableHead className="text-right w-[150px]">Price</TableHead>
                  <TableHead className="text-right w-[150px]">Difference</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const relatedCompetitors = competitorsByProduct[product.id] || [];
                  
                  // Get Wahlburgers price
                  const wahlburgersPrice = getLatestPrice(product.prices);
                  const wahlburgersPriceValue = wahlburgersPrice?.price || 0;
                  
                  return (
                    <React.Fragment key={product.id}>
                      {relatedCompetitors.length > 0 ? (
                        relatedCompetitors.map((competitor, index) => {
                          const competitorPrice = getLatestPrice(competitor.competitor_prices);
                          const competitorPriceValue = competitorPrice?.price || 0;
                          
                          const priceDiff = wahlburgersPriceValue - competitorPriceValue;
                          const percentDiff = wahlburgersPriceValue > 0 && competitorPriceValue > 0
                            ? (priceDiff / wahlburgersPriceValue) * 100 
                            : 0;
                            
                          const isFirst = index === 0;
                          
                          return (
                            <TableRow key={`${product.id}-${competitor.id}`} className="hover:bg-muted/50">
                              {isFirst ? (
                                <>
                                  <TableCell rowSpan={relatedCompetitors.length} className="font-medium border-r">
                                    {product.name}
                                    {wahlburgersPrice?.is_promotion && (
                                      <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-200">
                                        Promo
                                      </Badge>
                                    )}
                                    {wahlburgersPrice?.is_sold_out && (
                                      <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 border-red-200">
                                        Sold Out
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell rowSpan={relatedCompetitors.length} className="text-right border-r font-medium">
                                    {wahlburgersPrice 
                                      ? wahlburgersPrice.is_sold_out 
                                        ? 'Sold Out' 
                                        : `$${wahlburgersPrice.price.toFixed(2)}`
                                      : '-'
                                    }
                                  </TableCell>
                                </>
                              ) : null}
                              <TableCell className="font-medium">
                                {competitor.name}
                                <span className="text-sm text-muted-foreground ml-2">
                                  ({getCompetitorName(competitor.competitor)})
                                </span>
                                {competitorPrice?.is_promotion && (
                                  <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-200">
                                    Promo
                                  </Badge>
                                )}
                                {competitorPrice?.is_sold_out && (
                                  <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 border-red-200">
                                    Sold Out
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {competitorPrice 
                                  ? competitorPrice.is_sold_out 
                                    ? 'Sold Out' 
                                    : `$${competitorPrice.price.toFixed(2)}`
                                  : '-'
                                }
                              </TableCell>
                              <TableCell className="text-right">
                                {wahlburgersPrice && competitorPrice && !wahlburgersPrice.is_sold_out && !competitorPrice.is_sold_out ? (
                                  <div className="flex items-center justify-end">
                                    <span className={`font-medium ${priceDiff > 0 ? 'text-red-500' : priceDiff < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                                      {priceDiff !== 0 ? (
                                        <>
                                          {priceDiff > 0 ? (
                                            <ArrowUp className="inline h-4 w-4 mr-1" />
                                          ) : (
                                            <ArrowDown className="inline h-4 w-4 mr-1" />
                                          )}
                                          ${Math.abs(priceDiff).toFixed(2)} ({Math.abs(percentDiff).toFixed(1)}%)
                                        </>
                                      ) : (
                                        <>
                                          <Minus className="inline h-4 w-4 mr-1" />
                                          Same price
                                        </>
                                      )}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {competitorPrice?.timestamp 
                                  ? format(new Date(competitorPrice.timestamp), 'MMM d, yyyy')
                                  : '-'
                                }
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell className="font-medium">
                            {product.name}
                            {wahlburgersPrice?.is_promotion && (
                              <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-200">
                                Promo
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {wahlburgersPrice 
                              ? wahlburgersPrice.is_sold_out 
                                ? 'Sold Out' 
                                : `$${wahlburgersPrice.price.toFixed(2)}`
                              : '-'
                            }
                          </TableCell>
                          <TableCell colSpan={4} className="text-center text-muted-foreground italic">
                            No competitor products linked
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}