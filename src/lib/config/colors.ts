export const BRAND_COLORS = {
    primary: '#0284c7',    // Teal-700
    secondary: '#6366f1',  // Indigo-500
    success: '#14b8a6',    // Teal-500
    warning: '#f59e0b',    // Amber-500
    danger: '#ef4444',     // Red-500
    info: '#0ea5e9',       // Blue-500
    
    // Accent colors for charts
    chart: {
      blue: '#2563eb',
      indigo: '#6366f1',
      purple: '#a855f7',
      pink: '#ec4899',
      rose: '#f43f5e',
      red: '#ef4444',
      orange: '#f97316',
      amber: '#f59e0b',
      yellow: '#eab308',
      lime: '#84cc16',
      green: '#22c55e',
      emerald: '#10b981',
      teal: '#14b8a6',
      cyan: '#06b6d4',
      sky: '#0ea5e9',
    },
    
    // Chart gradients
    gradients: {
      blue: ['rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0.1)'],
      indigo: ['rgba(99, 102, 241, 0.8)', 'rgba(99, 102, 241, 0.1)'],
      teal: ['rgba(20, 184, 166, 0.8)', 'rgba(20, 184, 166, 0.1)'],
      amber: ['rgba(245, 158, 11, 0.8)', 'rgba(245, 158, 11, 0.1)'],
      red: ['rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.1)'],
    }
  }
  
  export const RETAILER_COLOR_MAP: Record<string, string> = {
    "Amazon": "#ff9900",
    "Walmart": "#0071ce",
    "Target": "#cc0000",
    "BestBuy": "#0046be",
    "Costco": "#005daa"
  }
  
  export const CHART_CONFIG = {
    common: {
      animate: true,
      animationDuration: 300,
      animationEasing: 'ease-in-out',
      strokeWidth: 2,
      dotRadius: 3,
      activeDotRadius: 6,
    },
    grid: {
      strokeDasharray: '3 3',
      stroke: '#e5e7eb', // gray-200
      vertical: true,
      horizontal: true,
    },
    tooltip: {
      contentStyle: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: 'none',
        borderRadius: '0.375rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '0.75rem',
      },
      itemStyle: {
        color: '#1f2937', // gray-800
        fontSize: '0.875rem',
        padding: '0.25rem 0',
      },
      labelStyle: {
        fontSize: '0.75rem',
        fontWeight: 'bold',
        color: '#4b5563', // gray-600
        marginBottom: '0.25rem',
      },
    }
  }