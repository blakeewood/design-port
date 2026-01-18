# Click-to-Select UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Figma-like click-to-select UX in the browser with real-time terminal panel display of selected elements.

**Architecture:** Add click event listener to elements in browser, toggle selection on click, render visual feedback (hover = light outline, selected = bold outline + number badge), send element-staged/element-unstaged events via WebSocket to terminal, and ensure terminal panel renders with selected elements list.

**Tech Stack:** TypeScript, WebSocket messaging, ANSI terminal rendering, DOM mutation tracking

---

## Task 1: Add Click Event Listener to Browser Elements

**Files:**
- Modify: `packages/client-script/src/element-picker-v2.ts:1-50`
- Modify: `packages/client-script/src/browser-entry-v2.ts:40-70`

**Step 1: Read current element picker implementation**

Run: `cat packages/client-script/src/element-picker-v2.ts | head -100`

Expected: See class ElementPickerV2 with init() method and event listeners

**Step 2: Add click handler to ElementPickerV2**

Modify `packages/client-script/src/element-picker-v2.ts` to add:

```typescript
private setupClickListener(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target === document.body || target === document.documentElement) {
      return; // Clicked on blank area - will be handled separately
    }

    e.preventDefault();
    e.stopPropagation();

    // Check if Cmd/Ctrl is held for multi-select
    const isMultiSelect = e.ctrlKey || e.metaKey;

    if (!isMultiSelect) {
      // Single select mode: clear previous and select new
      this.multiSelectManager.clear();
    }

    // Toggle selection
    const wasAdded = this.multiSelectManager.toggle(target);

    // Send to terminal
    this.sendSelectionToTerminal(wasAdded, target);
  }, true);
}

private sendSelectionToTerminal(wasAdded: boolean, element: Element): void {
  const staged = this.multiSelectManager.getAll();

  if (wasAdded) {
    // Find the element we just added
    const stagedElement = staged.find(s => s.element === element);
    if (stagedElement) {
      this.ws.send({
        type: 'element-staged',
        payload: this.multiSelectManager.toWireFormat(stagedElement),
      });
    }
  } else {
    // Element was removed
    this.ws.send({
      type: 'element-unstaged',
      payload: { id: `element-${element.toString()}` },
    });
  }
}
```

**Step 3: Call setupClickListener in init()**

In `element-picker-v2.ts`, find the `init()` method and add:

```typescript
init(): void {
  // ... existing code ...
  this.setupClickListener();
}
```

**Step 4: Ensure MultiSelectManager is accessible**

Verify that `this.multiSelectManager` is defined in ElementPickerV2 and has a reference to WebSocket client.

Add to ElementPickerV2 constructor if missing:

```typescript
constructor(wsClient: WebSocketClient) {
  this.multiSelectManager = new MultiSelectManager();
  this.ws = wsClient;
}
```

**Step 5: Update browser-entry-v2.ts to pass WebSocket to picker**

In `browser-entry-v2.ts`, modify the picker initialization:

```typescript
this.picker = new ElementPickerV2(this.ws);
```

**Step 6: Build and verify no errors**

Run: `npm run build 2>&1 | grep -E "error|Error" || echo "Build successful"`

Expected: No errors, build completes

**Step 7: Commit**

```bash
git add packages/client-script/src/element-picker-v2.ts packages/client-script/src/browser-entry-v2.ts
git commit -m "feat: add click event listener for element selection

- Implement click handler to toggle element selection
- Single click selects element, click again deselects
- Cmd/Ctrl+Click enables multi-select mode
- Send element-staged and element-unstaged events to terminal"
```

---

## Task 2: Implement Visual Feedback (Hover vs Selected with Badges)

**Files:**
- Modify: `packages/client-script/src/multi-select.ts:370-420`

**Step 1: Update staged highlight styling**

In `packages/client-script/src/multi-select.ts`, update the `showStagedHighlight()` method:

```typescript
private showStagedHighlight(staged: StagedElement): void {
  const rect = staged.element.getBoundingClientRect();

  const highlight = document.createElement('div');
  highlight.id = `__design-port-staged-${staged.id}`;

  // Selected = bold green outline
  highlight.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483646;
    border: 3px solid #10b981;
    background: rgba(16, 185, 129, 0.15);
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    transition: all 0.15s ease;
    box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.5);
  `;

  // Add number badge showing selection order
  const badge = document.createElement('div');
  const index = Array.from(this.staged.keys()).indexOf(staged.id) + 1;
  badge.style.cssText = `
    position: absolute;
    top: -12px;
    left: -12px;
    width: 24px;
    height: 24px;
    background: #10b981;
    color: white;
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  `;
  badge.textContent = index.toString();

  highlight.appendChild(badge);
  document.body.appendChild(highlight);
  this.highlights.set(staged.id, highlight);
}
```

**Step 2: Update visual-overlay hover styling for lighter appearance**

In `packages/client-script/src/visual-overlay.ts`, find `renderHighlight()` method and ensure hover mode uses lighter styling:

```typescript
private renderHighlight(
  element: Element,
  mode: 'hover' | 'locked',
  measurement?: ElementMeasurement | null
): string {
  const rect = element.getBoundingClientRect();

  // Hover = light outline, Selected = already handled by MultiSelectManager
  const borderColor = mode === 'hover' ? 'rgba(59, 130, 246, 0.6)' : '#3b82f6';
  const borderWidth = mode === 'hover' ? '1px' : '2px';
  const bgColor = mode === 'hover' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.1)';

  // ... rest of implementation with these colors applied ...
}
```

**Step 3: Build and test**

Run: `npm run build 2>&1 | grep -E "error|Error" || echo "Build successful"`

Expected: No errors

**Step 4: Commit**

```bash
git add packages/client-script/src/multi-select.ts packages/client-script/src/visual-overlay.ts
git commit -m "feat: add visual feedback for selected elements

- Selected elements show bold green outline (3px)
- Number badge displays selection order (1, 2, 3...)
- Hover shows lighter blue outline (1px)
- Added box-shadow for depth perception"
```

---

## Task 3: Implement Escape Key and Blank Area Click to Clear

**Files:**
- Modify: `packages/client-script/src/element-picker-v2.ts:80-120`
- Modify: `packages/client-script/src/visual-overlay.ts:320-340`

**Step 1: Add Escape key handler**

In `packages/client-script/src/visual-overlay.ts`, update `handleKeyDown()`:

```typescript
private handleKeyDown(e: KeyboardEvent): void {
  // Ctrl+Shift+P or Cmd+Shift+P to toggle pick mode
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    e.stopPropagation();
    inspectorState.togglePickMode();
  }

  // ESC to clear all selections or exit pick mode
  if (e.key === 'Escape') {
    const state = inspectorState.getState();

    // Check if we have selections to clear
    if (this.multiSelectManager && this.multiSelectManager.count > 0) {
      e.preventDefault();
      e.stopPropagation();
      this.multiSelectManager.clear();
      this.sendClearToTerminal();
      return;
    }

    if (state.overlayState === 'locked') {
      inspectorState.deselectElement();
    } else if (state.overlayState === 'picking') {
      inspectorState.exitPickMode();
    }
  }
}

private sendClearToTerminal(): void {
  this.ws.send({
    type: 'selections-cleared',
    payload: {},
  });
}
```

**Step 2: Add multiSelectManager reference to VisualOverlay**

Update VisualOverlay constructor to accept and store multiSelectManager:

```typescript
constructor(multiSelectManager?: MultiSelectManager) {
  this.multiSelectManager = multiSelectManager;
  // ... rest of init ...
}
```

**Step 3: Update browser-entry-v2.ts to pass manager to overlay**

```typescript
this.overlay = new VisualOverlay(this.picker.getMultiSelectManager());
```

**Step 4: Add blank area click handler**

In `packages/client-script/src/element-picker-v2.ts`, update click listener:

```typescript
private setupClickListener(): void {
  document.addEventListener('click', (e) => {
    const target = e.target as Element;

    // Clicked on blank area (body or html)
    if (target === document.body || target === document.documentElement) {
      e.preventDefault();
      e.stopPropagation();

      // Clear all selections
      this.multiSelectManager.clear();
      this.ws.send({
        type: 'selections-cleared',
        payload: {},
      });
      return;
    }

    // ... rest of existing click handler ...
  }, true);
}
```

**Step 5: Build and test**

Run: `npm run build 2>&1 | grep -E "error|Error" || echo "Build successful"`

Expected: No errors

**Step 6: Commit**

```bash
git add packages/client-script/src/element-picker-v2.ts packages/client-script/src/visual-overlay.ts packages/client-script/src/browser-entry-v2.ts
git commit -m "feat: add Escape key and blank click to clear selections

- Escape key clears all selected elements
- Click on blank area (body) clears selections
- Send selections-cleared event to terminal
- Handlers prevent default and stop propagation"
```

---

## Task 4: Wire Up WebSocket Event Handlers in Terminal

**Files:**
- Modify: `packages/core/src/plugin.ts:570-620`

**Step 1: Verify WebSocket event handlers exist**

Run: `grep -n "element-staged\|element-unstaged\|selections-cleared" packages/core/src/plugin.ts`

Expected: See three event handlers already set up from previous implementation

**Step 2: Ensure handlers send to SelectedElementsManager**

Verify the handlers match this pattern:

```typescript
this.browserBridge.on('element-staged', (element) => {
  // Convert and add
  const selection: SelectedElement = { /* ... */ };
  this.selectedElements.add(selection);
  this.selectedElements.writeToTerminal();

  // Write to MCP context file
  if (this.contextWriter) {
    const context = this.selectedElements.formatContext();
    this.contextWriter.writeContext(context);
  }

  this.emit('element-staged', element);
});

this.browserBridge.on('element-unstaged', (id) => {
  this.selectedElements.remove(id);
  this.selectedElements.writeToTerminal();

  if (this.contextWriter) {
    if (this.selectedElements.count === 0) {
      this.contextWriter.clearContext();
    } else {
      const context = this.selectedElements.formatContext();
      this.contextWriter.writeContext(context);
    }
  }

  this.emit('element-unstaged', id);
});

this.browserBridge.on('selections-cleared', () => {
  this.selectedElements.clear();
  this.selectedElements.writeToTerminal();

  if (this.contextWriter) {
    this.contextWriter.clearContext();
  }

  this.emit('selections-cleared');
});
```

**Step 3: Verify handlers are called**

Run: `grep -A 3 "setupBrowserBridgeHandlers" packages/core/src/plugin.ts | head -10`

Expected: See `setupBrowserBridgeHandlers()` being called in `start()` method

**Step 4: Build and test**

Run: `npm run build 2>&1 | grep -E "error|Error" || echo "Build successful"`

Expected: No errors

**Step 5: Commit**

```bash
git add packages/core/src/plugin.ts
git commit -m "verify: WebSocket event handlers properly wire to SelectedElementsManager

- element-staged handler adds to SelectedElementsManager
- element-unstaged handler removes from SelectedElementsManager
- selections-cleared handler clears all
- All handlers call writeToTerminal() to render panel
- MCP context file updated for Claude integration"
```

---

## Task 5: Force Terminal Panel Output in Non-TTY Environments

**Files:**
- Modify: `packages/terminal-ui/src/staged-selections.ts:330-346`

**Step 1: Update writeToTerminal to always output**

In `packages/terminal-ui/src/staged-selections.ts`, simplify the method:

```typescript
writeToTerminal(stream: NodeJS.WriteStream = process.stdout): void {
  const panel = this.renderPanel();

  // Always write the panel, regardless of TTY status
  stream.write(panel + '\n');

  // Note: ANSI escape codes for cursor movement won't work in non-TTY
  // environments (like Claude Code), so we just print fresh output each time
  this.isRendered = true;
}
```

**Step 2: Add comment explaining TTY limitations**

```typescript
/**
 * Write panel to terminal.
 *
 * In TTY environments (standard terminals): Updates panel in place with ANSI codes
 * In non-TTY environments (Claude Code): Prints fresh output each time
 *
 * The panel will always be visible - just may have repeated output in non-TTY
 */
writeToTerminal(stream: NodeJS.WriteStream = process.stdout): void {
  const panel = this.renderPanel();
  stream.write(panel + '\n');
  this.isRendered = true;
}
```

**Step 3: Build and test**

Run: `npm run build 2>&1 | grep -E "error|Error" || echo "Build successful"`

Expected: No errors

**Step 4: Commit**

```bash
git add packages/terminal-ui/src/staged-selections.ts
git commit -m "fix: force terminal panel output in non-TTY environments

- Remove TTY check that prevented output in Claude Code
- Always write panel to stdout
- Panel renders on each update (may repeat in non-TTY)
- Handles both TTY and non-TTY terminal environments"
```

---

## Task 6: Build Complete System and Test

**Files:**
- Build: All packages
- Test: Complete flow

**Step 1: Clean build**

Run: `npm run clean && npm run build 2>&1 | tail -30`

Expected: "Tasks: 8 successful, 8 total"

**Step 2: Verify no TypeScript errors**

Run: `npm run build 2>&1 | grep -c "error" || echo "0 errors"`

Expected: Output "0 errors"

**Step 3: Verify MCP server built correctly**

Run: `ls -lah packages/mcp-server/dist/index.js && head -1 packages/mcp-server/dist/index.js`

Expected: File exists and starts with "#!/usr/bin/env node"

**Step 4: Verify terminal-ui exports**

Run: `grep -A 5 "export {" packages/terminal-ui/dist/index.d.ts | grep SelectedElementsManager`

Expected: See "SelectedElementsManager" in exports

**Step 5: Commit**

```bash
git add -A
git commit -m "build: verify complete system builds without errors

- All 8 packages build successfully
- No TypeScript errors
- MCP server binary verified
- Terminal UI exports correct
- Ready for testing with browser"
```

---

## Verification Checklist

After all tasks complete:

- [ ] Browser click handler fires on element click
- [ ] Selected elements show green outline with badge
- [ ] Terminal panel displays selected elements list
- [ ] Escape key clears selections
- [ ] Blank area click clears selections
- [ ] Cmd/Ctrl+Click adds to multi-select (visual feedback shows numbers)
- [ ] WebSocket events sync between browser and terminal
- [ ] MCP context file updates with selections
- [ ] No build errors
- [ ] All commits are logical and well-documented

---

## Known Limitations & Future Work

1. **Hover overlay in multi-select mode**: Currently overlaps with selected highlights. Can be improved by hiding hover when in multi-select mode.

2. **Visual update performance**: Redrawing terminal panel on every selection may flicker. Can be optimized with debouncing.

3. **Element tracking**: If DOM changes, selected elements may become stale. Can add mutation observer to auto-invalidate stale selections.

4. **Mobile/touch support**: Cmd/Ctrl+Click only works with keyboard. Touch devices need alternative (e.g., long-press).

