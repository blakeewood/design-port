# design-port

Visual design editing for Claude Code: select UI components in a live browser, inspect design measurements and styles, and refine them with Claude in your terminal—all in real-time.

## How it works

Start DesignPort on your project, and it launches a live browser with your app running.

Click elements to inspect them. Select one or multiple buttons, inputs, cards—anything you want to refine. DesignPort instantly shows you what you're looking at: exact dimensions, spacing, colors, CSS classes, font info, and which file the component lives in.

All that context goes to Claude. DesignPort formats everything you've selected and sends it to Claude via MCP (Model Context Protocol). When you tell Claude "make the button match the input width" or "add more padding to the card," Claude sees your actual measurements and code—no guessing, no screenshots.

Ask Claude to refine. Type your design request in the terminal: "tighten the spacing," "align these elements," "use the primary color." Claude analyzes what you've selected and suggests code changes.

Watch it update live. Apply Claude's changes to your code, and the browser refreshes instantly. You see your refinements in real-time.

Keep iterating. Click a different element, ask Claude another question, refine again. Repeat until your UI is exactly how you want it.

## Installation

**Requirement:** Node.js 18+

### Claude Code (via Plugin Marketplace)

In your terminal, install DesignPort as a Claude Code plugin:

```bash
cd /path/to/your/project
claude /design-port
```

Claude Code will:
1. Detect your framework (Vite, Next.js, React CRA, Svelte, or static HTML)
2. Start your dev server if needed
3. Launch a browser with your app loaded
4. Open the terminal inspector UI

**Note:** If your project uses a non-standard dev server setup, you can configure the port:

```bash
claude /design-port --port 3001
```

### Verify Installation

You should see:

```
┌── DesignPort ────────────────────┐
│ Dev Server:    http://localhost:5173
│ Browser:       Connected
│ Inspect Mode:  Active
│ Staged:        0 elements
└──────────────────────────────────┘
```

If you see connection errors, check:
- Your dev server is running on the correct port
- Your project is in the current directory
- Node.js version is 18+

## The Basic Workflow

### 1. Launch DesignPort

```bash
claude /design-port
```

A browser window opens with your app loaded. You're in **Inspect Mode**.

### 2. Select Elements

In the browser:
- **Click any element** to inspect it (highlighted in the browser)
- **Shift+Click** to stage/unstage an element
- **Ctrl+K** (or **Cmd+K** on Mac) to clear all staged selections

Selected elements appear in the terminal under "Selected Elements" with:
- Element name and tag
- Exact dimensions (width × height)
- Computed box model (margin, padding, border)
- CSS classes applied
- Font properties
- Accessibility role (if set)
- Source file location

### 3. View Rich Context

Staged selections show up as formatted context:

```
┌── Selected Elements (2) ──────────────┐
│ 1. Button.primary    120x40
│    Box: padding 8px 16px, margin 0
│    Classes: px-4 py-2 bg-blue-500
│    Font: Inter 14px 500
│    File: src/Button.tsx:24
│
│ 2. Input#email       320x44
│    Box: padding 12px, margin 8px 0
│    Classes: rounded border border-gray-300
│    Font: System 16px 400
│    File: src/Form.tsx:12
└──────────────────────────────────────┘
```

### 4. Ask Claude

In your terminal, type to Claude:

```
"Can you increase the button padding to 12px 20px and make the text bold?"
```

Claude:
- Sees the staged elements automatically via `@design-port:staged-selections`
- Understands exact current state (dimensions, styles, classes)
- Suggests specific code changes
- Recommends the file to modify

### 5. Apply Changes

Edit the suggested file in your editor. The live browser updates instantly.

### 6. Iterate

Reselect elements, ask more questions, refine until perfect.

---

## Features

### Live Browser Inspector

- **Click to inspect** - Select any element on the page
- **Staged selections** - Compare multiple elements side-by-side
- **Rich context** - Dimensions, box model, styles, classes, accessibility
- **Source location** - Jump to the component file in your editor
- **Real-time updates** - See changes instantly as you edit code

### Claude Integration via MCP

DesignPort uses MCP (Model Context Protocol) to expose staged selections as a resource:

```
@design-port:staged-selections
```

Claude automatically references this when you ask design questions. No need to describe elements—Claude sees them exactly as they are.

**Example:**

```
You: "Make the spacing consistent with the design system"

Claude (sees staged elements):
I can see the button has padding 8px 16px, but your design tokens
define spacing as 12px 20px. Let me update it.

src/Button.tsx:
- padding: "8px 16px"
+ padding: "12px 20px"
```

### Framework Detection

Automatically detects and configures:

- **Vite** (Vue, React, Svelte, Solid)
- **Next.js** (App Router, Pages Router)
- **Create React App**
- **Svelte**
- **Static HTML**

If your framework isn't detected, you can configure it manually:

```bash
claude /design-port --framework next
```

### Design Token Integration

If your project uses design tokens (Figma Tokens, Style Dictionary, or CSS variables), DesignPort can reference them:

```
You: "What design token is this color using?"

Claude:
This is using --color-blue-500 (hex: #3b82f6).
Your design system defines it as primary-action-default.
```

## Common Tasks

### Compare Two Buttons

1. Click first button → Shift+Click to stage
2. Click second button → Shift+Click to stage
3. Ask Claude: "Why does this button look different?"

Claude sees both staged and explains the CSS differences.

### Align Form Inputs

1. Stage all input fields
2. Ask: "Make all inputs the same height and align them vertically"

Claude analyzes all selected dimensions and suggests alignment code.

### Fix Responsive Spacing

1. Stage element at desktop size
2. Ask: "What should the padding be on mobile?"

Claude references your design system and suggests responsive classes.

### Debug Layout Issues

1. Stage the container and children
2. Ask: "Why is this element overlapping?"

Claude sees all dimensions, positions, and suggests flex/grid fixes.

## MCP (Model Context Protocol)

DesignPort exposes staged selections as an MCP resource for seamless Claude integration.

### How It Works

1. When you stage elements, DesignPort writes formatted context to `/tmp/design-port-context-{projectHash}.txt`
2. The MCP server reads this file on-demand
3. Claude accesses via `@design-port:staged-selections`
4. Context auto-updates when selections change
5. Context expires after 1 hour of inactivity (cleaned up automatically)

### Resource Details

**URI:** `design-port://staged-selections`

**Content:** Formatted staged selections including:
- Element selectors and component names
- Dimensions (width, height)
- Box model (margin, padding, border)
- Computed styles (display, position, flex properties)
- CSS classes
- Font properties
- Accessibility role
- Source location (file and line number)

### Manual Access

You can also manually reference the resource in your Claude messages:

```
@design-port:staged-selections
```

This shows all currently staged elements in full detail.

## Architecture

### Components

- **Terminal UI** - Interactive inspector and staged selections display
- **Browser Bridge** - WebSocket communication between browser and terminal
- **Client Script** - Injected into browser for element inspection
- **Dev Server Manager** - Framework detection and dev server orchestration
- **Design Token Cache** - Optional integration with your design system
- **MCP Server** - Protocol handler for Claude integration

### Technology Stack

- **TypeScript** - Full type safety
- **Node.js** - Server runtime
- **WebSocket** - Browser-terminal communication
- **Model Context Protocol** - Claude integration
- **pnpm** - Monorepo package management
- **Turborepo** - Build orchestration

## Troubleshooting

### "Browser not connecting"

**Check:**
1. Dev server is running: `http://localhost:3000` or your configured port
2. Firewall isn't blocking WebSocket on port `9000+`
3. Your project is in the current directory

**Fix:**
```bash
# Restart with verbose output
claude /design-port --verbose
```

### "Element not responding when I click"

**Causes:**
1. JavaScript framework is shadowing clicks (overlays, portals)
2. Event listeners are preventing default behavior

**Try:**
1. Click on a parent container instead
2. Use your browser DevTools to inspect the element tree
3. Check for event listener conflicts

### "Staged context not showing in Claude"

**Check:**
1. You have elements staged (should show in terminal UI)
2. You mentioned design-related questions (Claude checks resource automatically)
3. MCP server is running (check logs: `claude /design-port --verbose`)

**Manually trigger:**
Type `@design-port:staged-selections` in your Claude message to see all context.

### "Dev server won't start"

**For Vite:**
```bash
# Vite defaults to port 5173
claude /design-port --port 5173
```

**For Next.js:**
```bash
# Next.js defaults to port 3000
claude /design-port --port 3000
```

**For custom ports:**
```bash
claude /design-port --port YOUR_PORT
```

## Contributing

DesignPort is open source and contributions are welcome!

### Setup Development Environment

```bash
git clone https://github.com/blakeewood/design-port.git
cd design-port
pnpm install
pnpm build
```

### Run in Development Mode

```bash
pnpm dev
```

### Project Structure

```
packages/
├── core/              # Main plugin orchestration
├── terminal-ui/       # Terminal inspector UI
├── browser-bridge/    # Browser-terminal communication
├── client-script/     # Injected browser script
├── server-manager/    # Dev server detection & launch
├── design-tokens/     # Design token cache & lookup
├── inspector/         # Browser inspector panel
├── mcp-server/        # MCP protocol handler
└── examples/          # Example projects
```

### Running Tests

```bash
pnpm test
```

### Building Distribution

```bash
pnpm build
```

Output goes to `packages/*/dist/`.

### Creating a PR

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and test thoroughly
4. Commit with clear messages
5. Push and create a pull request

**PR Checklist:**
- [ ] Tests pass: `pnpm test`
- [ ] Builds successfully: `pnpm build`
- [ ] Code is formatted: `pnpm format`
- [ ] No TypeScript errors: `pnpm typecheck`
- [ ] Changes documented if user-facing

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support & Feedback

- **Issues & Bugs:** [GitHub Issues](https://github.com/blakeewood/design-port/issues)
- **Discussions:** [GitHub Discussions](https://github.com/blakeewood/design-port/discussions)
- **Documentation:** Check the [packages](/packages) for detailed component docs

---

**Made for designers and developers who want to refine UI in real-time with Claude.**
