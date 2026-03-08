

## Fix: Empty String SelectItem Value in BulkAssignDialog

**Problem**: `src/components/crm/BulkAssignDialog.tsx` line 264 has `<SelectItem value="">All tags (distribute equally)</SelectItem>`. Radix UI's Select component does not allow empty string values on SelectItem — it's reserved for clearing the selection.

**Fix**: Change the empty string value to `"all"` and update the logic that checks for this value.

### Changes in `src/components/crm/BulkAssignDialog.tsx`

1. Change `<SelectItem value="">` to `<SelectItem value="all">` (line 264)
2. Update the state initialization for the tag filter from `""` to `"all"` 
3. Update any conditional logic that checks `=== ""` to check `=== "all"` instead

Single file, ~3 lines changed.

