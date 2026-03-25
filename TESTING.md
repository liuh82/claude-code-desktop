# CCDesk — Testing Checklist

## 1. Mermaid Rendering

- [ ] Send `/arch` and see Mermaid diagram renders correctly
- [ ] During streaming output, mermaid code block shows as code (not flickering SVG)
- [ ] After code block closes (` ``` `), SVG diagram renders
- [ ] Input natural language "draw an architecture diagram" triggers mermaid
- [ ] Invalid mermaid syntax shows friendly error message
- [ ] Mermaid block renders in separate chunk (check DevTools Network tab)

## 2. Message Actions

- [ ] Hover over AI message shows action buttons (Regenerate, Copy)
- [ ] Hover over user message shows action buttons (Copy, Edit)
- [ ] Click Regenerate — AI message is regenerated (old response removed)
- [ ] Click Copy — clipboard contains message content, button shows "Copied"
- [ ] Click Edit on user message — textarea appears with message content
- [ ] Edit message and submit — edited message replaces old, AI re-replies
- [ ] Click cancel in edit mode — returns to normal view
- [ ] Continuous Regenerate clicks don't produce duplicate messages
- [ ] Regenerate during generation shows loading state

## 3. Keyboard Shortcuts

- [ ] `Ctrl+Enter` sends message
- [ ] `Cmd+Enter` (Mac) sends message
- [ ] `Ctrl+Shift+C` stops generation
- [ ] `Cmd+Shift+C` (Mac) stops generation
- [ ] `Ctrl+/` focuses input textarea
- [ ] `Cmd+/` (Mac) focuses input textarea
- [ ] Chinese IME: `Ctrl+Enter` commits and sends correctly
- [ ] Empty input + `Ctrl+Enter` does nothing
- [ ] `Enter` still sends (existing behavior preserved)
- [ ] `Shift+Enter` inserts newline (existing behavior preserved)

## 4. Autocomplete

- [ ] Type `/` shows command list popup
- [ ] Command list includes `/compare`
- [ ] Select `/compare` inserts it into input field

## 5. Regression

- [ ] Normal chat messages render correctly
- [ ] Code blocks with syntax highlighting work
- [ ] Tool call cards display properly
- [ ] Permission blocks work (Allow/Deny)
- [ ] File @mention autocomplete works
- [ ] Model picker works
- [ ] Split pane works
- [ ] `/clear`, `/model`, `/cost`, `/status` commands still work
- [ ] Token counter in bottom hint updates correctly
