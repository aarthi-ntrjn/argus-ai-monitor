# Argus: Todo Panel Manual Tests

Manual tests for the "To Do or Not To Do" todo panel. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## T0: Todo panel

| # | Steps | Expected |
|---|-------|----------|
| T-01 | In the "To Do or Not To Do" panel, type "Buy groceries" and press Enter | The task appears in the list with an unchecked checkbox |
| T-02 | Type "Walk the dog" and press Enter | A second task appears below the first; both are unchecked |
| T-03 | Type "Read a book" and press Enter | A third task appears; all three tasks are visible and unchecked |
| T-04 | Refresh the page | All three tasks persist and remain unchecked |
| T-05 | Click on the text of an existing task (e.g. "Buy groceries") | The text becomes an editable input field |
| T-06 | Change the text to "Buy organic groceries" and click away (blur) | The task text updates to the new value; the change is saved |
| T-07 | Refresh the page | The edited task still shows "Buy organic groceries" |
| T-08 | Click the checkbox on a task | The task is marked as done (checkbox is checked; text is struck through) |
| T-09 | Toggle **Hide completed** ON | Completed tasks disappear from the list |
| T-10 | Toggle **Hide completed** OFF | Completed tasks reappear |
| T-11 | Click the delete (trash) icon on a task | The task is removed from the list |
| T-12 | Refresh the page | All tasks persist (stored in the database) |
