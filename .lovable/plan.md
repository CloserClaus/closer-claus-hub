

## Properly Tag Incoming vs Outgoing Calls

### Problem
The `call_logs` table has no `direction` column. Currently, all calls display an outgoing icon. Inbound calls logged by the webhook can only be identified by their `notes` field containing "Inbound call", which is fragile and not queryable.

### Solution

**1. Add a `direction` column to the `call_logs` table**
- New column: `direction` (text, default `'outbound'`, not null)
- Update existing inbound records: any row where `notes` starts with "Inbound call" gets set to `'inbound'`

**2. Update the Twilio webhook to set direction on insert**
- Outbound browser calls (line ~59): set `direction: 'outbound'`
- True inbound calls (line ~294): set `direction: 'inbound'`

**3. Update the Recent Calls UI (`src/pages/Dialer.tsx`)**
- Remove the status badge (`getCallStatusBadge` call) and disposition text from lines 1050-1057
- Replace the hardcoded `PhoneOutgoing` icon (line 1061) with conditional logic:
  - If `log.direction === 'inbound'`: show `PhoneIncoming` icon + "Incoming" label
  - Otherwise: show `PhoneOutgoing` icon + "Outgoing" label
- Keep duration display as-is

### Technical Details

**Migration SQL:**
```sql
ALTER TABLE public.call_logs 
  ADD COLUMN direction text NOT NULL DEFAULT 'outbound';

UPDATE public.call_logs 
  SET direction = 'inbound' 
  WHERE notes LIKE 'Inbound call%';
```

**Webhook changes (`supabase/functions/twilio-webhook/index.ts`):**
- Add `direction: 'outbound'` to the outbound call insert (~line 59)
- Add `direction: 'inbound'` to the inbound call insert (~line 294)

**UI changes (`src/pages/Dialer.tsx`):**
- Lines 1050-1057: Remove `getCallStatusBadge` call and disposition text
- Line 1061: Replace static `PhoneOutgoing` with direction-based icon using `log.direction`
- Import `PhoneIncoming` from lucide-react

