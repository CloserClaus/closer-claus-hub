

## Add 2000 Credits to Agency 4 (agency4@testcompany.com)

**Workspace ID**: `00873d81-55dc-4eef-86ad-a1a350c67cc6`

This workspace has no existing `lead_credits` row, so a new row will be inserted with `credits_balance = 2000`.

**SQL to execute via insert tool:**
```sql
INSERT INTO lead_credits (workspace_id, credits_balance, last_purchased_at)
VALUES ('00873d81-55dc-4eef-86ad-a1a350c67cc6', 2000, now());
```

| Action | Detail |
|--------|--------|
| Insert into `lead_credits` | 2000 credits for workspace `00873d81...` |

