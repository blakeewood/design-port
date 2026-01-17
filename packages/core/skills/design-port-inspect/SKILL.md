---
name: design-port-inspect
description: Use this skill when the user wants to visually inspect UI elements, get measurements, extract design tokens, find Tailwind classes, analyze CSS properties, or understand component structure in a web application. Triggers on requests like "inspect this element", "what are the design tokens", "show me the measurements", "analyze the UI", "what Tailwind classes", "extract styles from the page".
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# DesignPort Visual Inspector Skill

You are helping the user inspect and analyze visual UI elements in their web application using DesignPort.

## When to Use This Skill

Use this skill when the user asks about:
- Inspecting UI elements visually
- Getting measurements (width, height, padding, margin)
- Extracting design tokens or Tailwind classes
- Understanding CSS properties of elements
- Finding component source locations
- Analyzing the visual design of their application

## How DesignPort Works

DesignPort is a visual inspection tool that:
1. Launches a browser showing the user's web application
2. Lets them click on elements to inspect them
3. Displays detailed measurements and design tokens in the terminal
4. Shows component names and source file locations

## Starting the Inspector

First, locate the DesignPort plugin installation and run the CLI:

```bash
# Find the plugin directory
DESIGN_PORT_DIR=$(find ~/.claude/plugins -name "design-port" -type d 2>/dev/null | grep -E "packages/core$" | head -1)

# If not found in standard location, check marketplaces
if [ -z "$DESIGN_PORT_DIR" ]; then
  DESIGN_PORT_DIR=$(find ~/.claude/plugins/marketplaces -type d -name "core" 2>/dev/null | xargs -I {} dirname {} | head -1)/packages/core
fi

# Install dependencies if needed (first run only)
if [ -d "$DESIGN_PORT_DIR" ] && [ ! -d "$DESIGN_PORT_DIR/node_modules" ]; then
  echo "Installing DesignPort dependencies..."
  cd "$DESIGN_PORT_DIR/../.." && npm install && npm run build
fi

# Run the inspector on the target project
cd <project-directory>
node "$DESIGN_PORT_DIR/dist/cli.js"
```

Or with options:
```bash
node "$DESIGN_PORT_DIR/dist/cli.js" --port 3000 --browser chrome
```

### CLI Options

- `--port <number>` - Specify the dev server port
- `--browser <path>` - Path to Chrome/Chromium executable
- `--headless` - Run in headless mode (for automated testing)
- `--verbose` - Enable debug logging
- `--help` - Show help message

### Development Mode

If working with the DesignPort source repository directly:

```bash
cd /path/to/design-port
pnpm install && pnpm build
node packages/core/dist/cli.js /path/to/target/project
```

## Framework Support

DesignPort automatically detects and supports:
- **Vite** - React, Vue, Svelte projects
- **Next.js** - With App Router detection
- **Create React App** - Standard CRA projects
- **SvelteKit** - Svelte framework projects
- **Static HTML** - Plain HTML/CSS files

## What Gets Displayed

When the user clicks an element in the browser, the terminal shows:

### Box Model Measurements
- Content dimensions (width × height)
- Padding (top, right, bottom, left)
- Border (width, style, color)
- Margin (top, right, bottom, left)

### Typography
- Font family, size, weight
- Line height, letter spacing
- Text color

### Design Tokens
- Tailwind CSS classes with resolved values
- CSS custom properties (variables)
- Chakra UI theme tokens

### Component Information
- React component name (via React DevTools)
- Vue component name (via Vue DevTools)
- Svelte component name (via Svelte DevTools)
- Source file path and line number

## Workflow Example

1. User asks: "I want to see what styles are on my header component"

2. You respond: "I'll start the DesignPort inspector so you can click on the header element."

3. Run the command:
   ```bash
   cd /path/to/project
   npx @design-port/core
   ```

4. Tell the user: "The browser is opening. Click on the header element to see its measurements and design tokens in the terminal."

5. After they click, help interpret the output if needed.

## Troubleshooting

### Browser doesn't open
- Check if Chrome/Chromium is installed
- Try specifying the browser path: `--browser /path/to/chrome`

### Dev server won't start
- Ensure dependencies are installed (`npm install`)
- Check if the port is already in use
- Try a different port: `--port 3001`

### No component names showing
- Ensure React/Vue/Svelte DevTools extensions concepts are understood
- Component detection works best in development mode

## Guidelines

1. Always confirm the project directory before starting
2. Let the user know the browser will open automatically
3. Explain that they should click elements to inspect them
4. Help interpret the design token output if they have questions
5. If they need specific CSS values, guide them to click the relevant element
