export const RETAILERS = [
    'Jewel-Osco',
    'Stop & Shop',
    'Acme',
    'Shaws',
    'Giant Eagle',
    'Giant Food Stores',
    'Big Y',
    'Publix',
    'Safeway'
  ] as const;

  // Hybrid scheme: keep each retailer's genuinely distinct brand color
  // (Shaws orange, Publix green, Stop & Shop lime) and reassign the six
  // near-identical brand reds to spaced, distinguishable hues so the lines
  // are readable. Brand green (#44B549) stays reserved for primary series.
  export const RETAILER_COLORS: Record<string, string> = {
    'Jewel-Osco': '#2563eb',        // reassigned — blue
    'Stop & Shop': '#86c301',       // brand — lime green
    'Acme': '#7c3aed',              // reassigned — violet
    'Shaws': '#f78427',             // brand — orange
    'Giant Eagle': '#0891b2',       // reassigned — cyan
    'Giant Food Stores': '#db2777', // reassigned — magenta
    'Big Y': '#64748b',             // reassigned — slate
    'Publix': '#3d8c2f',            // brand — green
    'Safeway': '#e11d48'            // reassigned — red (now the only red)
  };