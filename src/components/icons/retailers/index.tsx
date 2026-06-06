import * as React from "react"
import { AcmeIcon } from "./acme"
import { BigYIcon } from "./big-y"
import { GiantEagleIcon } from "./giant-eagle"
import { GiantFoodStoresIcon } from "./giant-food-stores"
import { JewelOscoIcon } from "./jewel-osco"
import { PublixIcon } from "./publix"
import { SafewayIcon } from "./safeway"
import { ShawsIcon } from "./shaws"
import { StopAndShopIcon } from "./stop-and-shop"

// Shared map of retailer name -> brand icon component.
export const RETAILER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Acme: AcmeIcon,
  "Big Y": BigYIcon,
  "Giant Eagle": GiantEagleIcon,
  "Giant Food Stores": GiantFoodStoresIcon,
  "Jewel-Osco": JewelOscoIcon,
  Publix: PublixIcon,
  Safeway: SafewayIcon,
  Shaws: ShawsIcon,
  "Stop & Shop": StopAndShopIcon,
}
