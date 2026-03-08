

# Fix: AI Filter Deleting 100% of Leads + Stuck Validation Resilience

## What Happened

Your run `db084deb` did unstick and advance to stage 2 on its own. Here's the timeline:

1. **Stage 1** collected 54 leads (quality rated LOW — 0% company_linkedin_url, 0% employee_count)
2. **Stage 2** (ai_filter) ran with prompt: *"Identify if the job title is a standard sales role..."*
3. The AI classified **all 54 leads as false** → deleted all 54 → quality check saw 0 leads → **USELESS → aborted**

The run is now `status: failed`, `processing_phase: aborted`. All leads were permanently deleted.

## Root Causes

**Problem 1: AI filter prompt is misaligned with data.** The stage 2 prompt asks the AI to evaluate `{{title}}`, but the leads from a LinkedIn jobs scraper have the *job posting title* (e.g., "Marketing Manager"), not a clean role field. The `title` field likely contained job posting titles that don't cleanly match "AE, SDR, Sales Rep" — so the strict classifier rejected everything.

**Problem 2: No safeguard against mass deletion.** If the AI filter removes >80-90% of leads, it's likely the filter itself is wrong, not the data. There's no circuit breaker.

**Problem 3: AI filter permanently deletes leads.** Once deleted, there's no recovery. If the filter was wrong, the entire run is toast.

**Problem 4: `pipelineValidating` still lacks error resilience** (the fix from the previous plan wasn't implemented yet).

## Plan

### 1. Add circuit breaker to AI filter (process-signal-queue)

In `executeAIFilter`, after computing `failedIds`:
- If `failedIds.length / leads.length > 0.85` (>85% rejection), **do not delete**
- Instead, log a warning, mark leads with a `filtered_out` flag (soft delete), and set quality to LOW with reason "AI filter rejected >85% — likely prompt mismatch"
- This preserves leads for recovery

### 2. Soft-delete instead of hard-delete in AI filter

Change the AI filter from `DELETE` to `UPDATE ... SET pipeline_stage = 'filtered_out'`. Then downstream stages query `WHERE pipeline_stage != 'filtered_out'`. This makes filtering reversible.

### 3. Add error resilience to pipelineValidating (previously planned)

Wrap `qualityCheckStage` in try/catch that defaults to `{ quality: "MEDIUM" }` on error, preventing infinite stuck loops.

### 4. Log AI filter input/output for debugging

Before the AI call, log 2-3 sample lead objects being sent to the classifier. This makes it possible to diagnose why the AI rejected everything without needing to reproduce the run.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/process-signal-queue/index.ts` | Circuit breaker on >85% rejection, soft-delete instead of hard-delete, error resilience in pipelineValidating, debug logging |

