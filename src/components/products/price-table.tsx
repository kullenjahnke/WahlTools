import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
  
  interface Price {
    id: string
    retailer: string
    price: number
    timestamp: string
  }
  
  interface PriceTableProps {
    prices: Price[]
  }
  
  export function PriceTable({ prices }: PriceTableProps) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Retailer</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prices.map((price) => (
              <TableRow key={price.id}>
                <TableCell className="font-medium">{price.retailer}</TableCell>
                <TableCell>${price.price.toFixed(2)}</TableCell>
                <TableCell>{new Date(price.timestamp).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {prices.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  No price data available.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    )
  }
  