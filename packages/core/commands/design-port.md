---
description: Start the DesignPort visual UI inspector to analyze elements, measurements, and design tokens in a browser
argument-hint: [project-path]
---

# DesignPort Visual Inspector

Start the DesignPort browser inspector to visually analyze UI elements in a web application.

## What This Command Does

1. **Detects the project framework** (Vite, Next.js, CRA, Svelte, or static HTML)
2. **Starts the dev server** if not already running
3. **Launches a browser** (Chrome/Chromium via Puppeteer)
4. **Injects the inspector script** for element picking
5. **Displays measurements and design tokens** in the terminal when elements are clicked

## Usage

```
/design-port [project-path]
```

- If no path is provided, uses the current working directory
- The browser will open automatically showing the running application

## How to Use the Inspector

Once the browser opens:

1. **Hover over elements** to see a highlight overlay with dimensions
2. **Click an element** to inspect it - measurements and design tokens appear in the terminal
3. **Press Escape** to exit inspection mode
4. **Press Ctrl+C** in the terminal to stop the inspector

## Information Displayed

When you click an element, the terminal shows:

### Measurements
- Width, height, padding, margin, border
- Position (x, y coordinates)
- Font size, line height, font family

### Design Tokens
- **Tailwind classes** - Resolved utility classes (e.g., `text-blue-500` → `#3b82f6`)
- **CSS variables** - Custom properties and their computed values
- **Chakra UI tokens** - Theme tokens if using Chakra

### Component Info
- **React** - Component name and file path from React DevTools
- **Vue** - Component name from Vue DevTools
- **Svelte** - Component name from Svelte DevTools

### Source Location
- File path and line number where the component is defined
- Clickable links in supported terminals

## Requirements

- Node.js 18+
- Chrome or Chromium browser installed
- A web project with a dev server (Vite, Next.js, CRA, etc.) or static HTML files

## Example Output

```
┌─────────────────────────────────────────────────────────────┐
│ Element: <button class="btn btn-primary">                   │
├─────────────────────────────────────────────────────────────┤
│ Dimensions     │ 120px × 40px                               │
│ Padding        │ 8px 16px                                   │
│ Margin         │ 0px                                        │
│ Font           │ 14px / 1.5 Inter                           │
├─────────────────────────────────────────────────────────────┤
│ Design Tokens                                               │
│ ─────────────                                               │
│ bg-blue-500    │ #3b82f6                                    │
│ text-white     │ #ffffff                                    │
│ rounded-md     │ 6px                                        │
├─────────────────────────────────────────────────────────────┤
│ Component: Button                                           │
│ Source: src/components/Button.tsx:24                        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation

To run the inspector, execute the DesignPort CLI:

```bash
cd $ARGUMENTS
npx @design-port/core
```

Or if arguments are empty, run in the current directory:

```bash
npx @design-port/core
```

The CLI will:
1. Auto-detect the framework
2. Start the appropriate dev server
3. Launch the browser with the inspector
4. Stream element information to the terminal as you click
