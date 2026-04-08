# Argus: Todo Panel Manual Tests

Manual tests for the "To Tackle" todo panel. Run these against a live Argus instance.

**Prerequisites:**
1. `npm run dev` running (backend on `http://localhost:7411`)

---

## S7: Todo panel

| # | Steps | Expected |
|---|-------|----------|
| S7-01 | In the "To Tackle" panel, type "Buy groceries" and press Enter | The task appears in the list with an unchecked checkbox |
| S7-02 | Type "Walk the dog" and press Enter | A second task appears below the first; both are unchecked |
| S7-03 | Type "Read a book" and press Enter | A third task appears; all three tasks are visible and unchecked |
| S7-04 | Refresh the page | All three tasks persist and remain unchecked |
| S7-05 | Click the checkbox on a task | The task is marked as done (checkbox is checked; text styling changes) |
| S7-06 | Toggle **Hide completed** ON | Completed tasks disappear from the list |
| S7-07 | Toggle **Hide completed** OFF | Completed tasks reappear |
| S7-08 | Click the delete (trash) icon on a task | The task is removed from the list |
| S7-09 | Refresh the page | All tasks persist (stored in the database) |
