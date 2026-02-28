

# Klaus Improvements: Competence + UI Fix

## Problem
1. Klaus gives generic/wrong advice despite having correct onboarding flow in the system prompt — needs stronger enforcement
2. The "Ask Klaus" button currently spawns a **separate floating window + minimized pill** instead of opening a bigger panel from within the existing help button

## Plan

### 1. Strengthen Klaus system prompt for better competence
**File**: `supabase/functions/klaus/index.ts`

- Add a `CRITICAL RULES` section at the top of the system prompt that forces Klaus to ALWAYS call `get_platform_state` before answering any "what should I do" / "next steps" / onboarding question — make this an absolute rule, not a suggestion
- Add stronger wording: "NEVER suggest actions that skip steps in the onboarding flow. If the agency has no SDRs hired, do NOT suggest making calls or sending emails."
- Add role-based persona context: if agency_owner with 0 SDRs, Klaus must focus on hiring before anything operational
- Increase `max_tokens` to 3000 for more detailed responses
- Add a `tool_choice: "auto"` parameter to encourage tool usage

### 2. Fix UI: Klaus opens from help button as a larger panel
**Files**: `src/components/help/HelpWidget.tsx`, `src/components/klaus/KlausChat.tsx`

Current behavior: Clicking "Ask Klaus" closes the popover and opens a completely separate floating window + a minimized pill button. Two separate floating elements on screen.

New behavior:
- Remove the separate floating Klaus window and minimized pill from HelpWidget
- When "Ask Klaus" is clicked, the help popover closes and a **larger floating panel** opens anchored to the bottom-right (same position as help button area)
- The panel is ~480px wide × ~620px tall with a close button that returns to the help button state
- Minimize collapses Klaus back into the help button (no separate pill)
- The help button icon changes to the Bot icon when Klaus is open/minimized, so user knows Klaus is active
- Clicking the help button while Klaus is minimized restores Klaus instead of opening the popover

Changes to `HelpWidget.tsx`:
- Keep `klausOpen` and `klausMinimized` state
- When `klausOpen && !klausMinimized`: render `<KlausChat>` as the floating panel, hide the popover
- When `klausOpen && klausMinimized`: show the help button with Bot icon; clicking it restores Klaus
- When `!klausOpen`: normal help popover behavior
- Remove the separate minimized pill button entirely

Changes to `KlausChat.tsx`:
- Keep the current floating panel design (it's already the right size)
- Ensure `onClose` resets both `klausOpen` and `klausMinimized` to false
- Ensure `onMinimize` sets minimized state so help button absorbs it

### 3. Add suggested follow-up actions after Klaus responses
**File**: `src/components/klaus/KlausChat.tsx`

- After each Klaus response, show quick-action chips below the message if the conversation is short (< 5 messages) to guide users toward the next logical question
- Chips like "Help me with that", "What else?", "Show my stats"

