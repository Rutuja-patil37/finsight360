# FinSight 360 Design Guidelines

These guidelines define the premium, design-system-aligned tokens used throughout the FinSight 360 frontend dashboard, inspired by the "$10K Website" template principles.

## Spacing & Grid System
We use an **8px base grid** for all layouts, gaps, padding, and margins. This is explicitly mapped in our Tailwind spacing configuration:
- `grid1` = `4px`
- `grid2` = `8px`
- `grid3` = `12px`
- `grid4` = `16px` (Standard padding)
- `grid6` = `24px` (Card padding)
- `grid8` = `32px`
- `grid12` = `48px`
- `grid16` = `64px`

## Colors & Themes (Dark Mode Default)
Our application enforces a sleek dark theme:
- **Base Background**: `#09090b` (`bg-zinc-950`)
- **Card Background**: `#0c0c0e` with thin border `border-zinc-900`
- **Frosted Glass (Morphism)**: `bg-[#09090b]/80 backdrop-blur-md border-b border-zinc-900`
- **Text Primary**: `#fafafa` (`text-zinc-50`)
- **Text Secondary/Muted**: `#a1a1aa` (`text-zinc-400`)
- **Accent Primary**: `#ffffff` (`bg-white text-black`)
- **Accent Growth (Positive)**: `#10b981` (`text-emerald-500` or `bg-emerald-950/40 border-emerald-500`)
- **Accent Conflict (Negative)**: `#ef4444` (`text-rose-500` or `bg-rose-950/40 border-rose-500`)

## Typography
- **Sans-Serif Font (General)**: `Inter`, system-ui, -apple-system, sans-serif
- **Mono Font (Numbers/Financial Tables/Citations)**: `JetBrains Mono`, monospace
- **Hierarchy**:
  - Main Heading: `text-4xl sm:text-7xl font-sans font-bold tracking-tight text-white leading-none`
  - Dashboard Heading: `text-2xl font-bold tracking-tight text-white`
  - Card Title: `text-sm font-semibold tracking-wider text-zinc-400 uppercase`
  - Data Values: `text-2xl font-mono font-bold text-white`

## Animations
All page transitions and interactive elements are animated using **Framer Motion**:
- **Hover Scale**: `whileHover={{ scale: 1.01 }}` with `borderColor: '#27272a'`
- **Tab Change Transition**: Smooth slide and fade reveals.
- **Section Load Reveal**:
  ```typescript
  const sectionReveal = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } 
    }
  };
  ```
