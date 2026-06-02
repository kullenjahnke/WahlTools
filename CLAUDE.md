# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
pnpm dev                  # Start development server on http://localhost:3000
pnpm build               # Build for production
pnpm start               # Start production server
pnpm lint                # Run Next.js linting

# Package manager
# This project uses pnpm as the package manager (see pnpm-lock.yaml)
pnpm install             # Install dependencies
pnpm add <package>       # Add new dependency
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 15.1.6 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with middleware protection
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS with custom animations
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization

### Project Structure

```
src/
├── app/
│   ├── (auth)/          # Auth pages (login, register)
│   ├── (dashboard)/     # Protected dashboard routes
│   │   └── dashboard/
│   │       ├── products/
│   │       ├── prices/
│   │       ├── analytics/
│   │       └── settings/
│   ├── actions/         # Server actions
│   │   ├── products.ts
│   │   ├── prices.ts
│   │   └── images.ts
│   └── api/            # API routes
├── components/
│   ├── ui/             # shadcn/ui components
│   ├── products/       # Product management components
│   ├── prices/         # Price tracking components
│   ├── analytics/      # Analytics and charts
│   ├── dashboard/      # Dashboard components
│   ├── auth/           # Authentication components
│   └── icons/          # Custom retailer icons
├── lib/
│   ├── supabase/       # Supabase client setup
│   ├── config/         # Configuration (retailers, colors)
│   ├── prices/         # Price utility functions
│   └── utils/          # General utilities
├── types/
│   └── supabase.ts     # Database types
└── middleware.ts       # Auth middleware
```

### Key Architecture Patterns

1. **Authentication Flow**: Middleware-based protection using Supabase Auth. All `/dashboard/*` routes require authentication.

2. **Database Schema**: 
   - `products`: Core product data with categories
   - `prices`: Price tracking by retailer with timestamps
   - `product_images`: Product image management
   - `product_urls`: Retailer-specific product URLs
   - `price_check_logs`: Tracking manual price checks

3. **Server Actions**: Located in `src/app/actions/`, used for database operations and form submissions.

4. **Retailer Configuration**: Centralized in `src/lib/config/retailers.ts` with 11 supported retailers.

5. **Component Architecture**: 
   - UI components from shadcn/ui in `src/components/ui/`
   - Feature components organized by domain (products, prices, analytics)
   - Server components for data fetching, client components for interactivity

### Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Important Notes

- Image uploads are configured for Supabase Storage (see `next.config.ts`)
- Server actions have a 5MB body size limit
- The app tracks prices for Wahlburgers products across multiple retail chains
- Middleware handles authentication redirects automatically
- All timestamps use ISO format stored in Supabase