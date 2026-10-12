# Frontend Design Skill - FinSight 360

This skill defines the design tokens, spacing principles, component hierarchies, and interactive behavior rules for building the FinSight 360 interface in Next.js + Tailwind CSS + Framer Motion.

## Design Tokens

### 1. Typography System
*   **Primary Font**: `Inter`, system sans-serif (clean, professional, modern).
*   **Monospace Font**: System monospace (specifically for financial values, rates, and numbers to prevent layout shifting and ensure readability).
*   **Scale**:
    *   `text-xs` (12px) - Subtitles, metadata, secondary captions.
    *   `text-sm` (14px) - Default copy, form input labels, button text.
    *   `text-base` (16px) - Regular text, transaction item titles.
    *   `text-lg` (18px) - Metric numbers, section subtitles.
    *   `text-xl` (20px) - Card titles, important summary highlights.
    *   `text-2xl` (24px) - Logo brand title, page headings.

### 2. Spacing & Grid System
*   **Base Grid**: 8px increments (`p-2`, `p-4`, `p-6`, `p-8` / `gap-2`, `gap-4`, `gap-6`, `gap-8`).
*   **Card Padding**: Standard `p-6` (24px) for cards to maintain breathing room.
*   **Margins**: `mt-4`, `mb-6` to separate logical sections.
*   **Layout Grid**: 2-column layout on desktop for main cards (Profile & Goals), full-width responsive columns.

### 3. Color Tokens (Dark Theme)
*   **Main Canvas Background**: `#090A0C` (pitch-dark black).
*   **Card Container Background**: `#121315` (elevated dark grey).
*   **Wrapper & Inner Elements**: `#090A0C` (dark recess).
*   **Borders**: `#1E293B` (subtle slate border).
*   **Text Primary**: `#FFFFFF` (pure white).
*   **Text Secondary**: `#94A3B8` (cool muted slate).
*   **Accent Green (Savings/Positive)**: `#00F29F` or `#10B981` (vibrant emerald).
*   **Accent Yellow/Orange (Medium Priority/Warning)**: `#F59E0B` (warm amber).
*   **Accent Red (High Priority/Conflict/Alert)**: `#EF4444` (crimson red).

### 4. Interactive Components & Motion (Framer Motion)
*   **Transitions**: Use spring-based animations for hover effects and page loads.
*   **Enter Animations**:
    *   Fade-in-up for cards (`y: 20` to `y: 0`, duration `0.4s`, ease `easeOut`).
    *   Staggered entrance for list items (goals list) using Framer Motion container variants.
*   **Buttons**: Hover scale (`1.02`), active press scale (`0.98`), smooth transitions.
*   **Tabs**: Pill layout with thin green border highlighting active selection. Active highlight should animate sliding between pills if possible (using Framer Motion `layoutId`).

## Rules of Hierarchy
*   Keep the dashboard clean. Do not add unnecessary decorative boxes.
*   Focus on readability of financial numbers. Currency symbols must be aligned.
*   All forms must have clear input states (hover, focus ring in `#00F29F`).
