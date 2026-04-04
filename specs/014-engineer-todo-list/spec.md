# Feature Specification: Engineer Todo List on Dashboard

**Feature Branch**: `014-engineer-todo-list`  
**Created**: 2026-04-04  
**Status**: Draft  
**Input**: User description: "create a todolist on the main dashboard. This is a checklist of things for the engineer to do. its just a reminder space for them to work on."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add and View Todo Items (Priority: P1)

An engineer opens the main dashboard and sees a todo list panel. They can add a new reminder item by typing a short description and confirming. The item immediately appears in their list. This is their personal scratchpad for tracking things they need to remember during a session.

**Why this priority**: Core value of the feature — without the ability to add and view items, nothing else matters.

**Independent Test**: Can be tested end-to-end by opening the dashboard, adding a todo item, and verifying it appears in the list.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** the engineer types a description and submits, **Then** the new todo item appears in the list immediately.
2. **Given** the dashboard is open with existing items, **When** the engineer views the dashboard, **Then** all previously added items are visible in the todo list panel.

---

### User Story 2 - Check Off Todo Items (Priority: P1)

An engineer marks a todo item as done by checking it off. The item is visually distinguished from incomplete items (e.g., strikethrough or greyed out), giving the engineer a sense of progress.

**Why this priority**: Checking items off is fundamental to a useful reminder checklist — without completion tracking the list quickly becomes noise.

**Independent Test**: Can be tested by adding an item and then toggling it as complete, verifying the visual state changes.

**Acceptance Scenarios**:

1. **Given** an unchecked todo item exists, **When** the engineer checks it, **Then** it is marked as done with a visual indicator.
2. **Given** a checked todo item exists, **When** the engineer unchecks it, **Then** it reverts to incomplete state.

---

### User Story 3 - Delete Todo Items (Priority: P2)

An engineer removes a todo item they no longer need. The item disappears from the list immediately.

**Why this priority**: Deletion keeps the list clean and focused. Important but not MVP-blocking — items can accumulate temporarily.

**Independent Test**: Can be tested by adding an item and then deleting it, verifying it is removed from the list.

**Acceptance Scenarios**:

1. **Given** a todo item exists, **When** the engineer deletes it, **Then** the item is removed from the list.
2. **Given** only one item exists and it is deleted, **When** the list is empty, **Then** an empty state message is shown.

---

### User Story 4 - Todo List Persists Across Sessions (Priority: P2)

An engineer closes and reopens the dashboard. Their todo items are still there, unchanged. The list survives page refreshes and session restarts.

**Why this priority**: Without persistence, the list loses its utility as a reminder tool between work sessions.

**Independent Test**: Can be tested by adding items, refreshing the page, and confirming all items are still present.

**Acceptance Scenarios**:

1. **Given** the engineer has added todo items, **When** the dashboard is refreshed or reopened, **Then** all items (with their completion state) are still present.

---

### Edge Cases

- What happens when the engineer submits an empty todo item? The system should reject it with a clear message.
- What happens when a todo item description is very long? The UI should truncate or wrap gracefully without breaking the layout.
- What happens when the todo list has many items? The list should scroll rather than push other dashboard content out of view.
- What happens when two sessions for the same engineer are open simultaneously? Last write wins; no data corruption.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add a new todo item by entering a text description.
- **FR-002**: Users MUST be able to view all their todo items on the main dashboard.
- **FR-003**: Users MUST be able to mark a todo item as complete or incomplete (toggle).
- **FR-004**: Users MUST be able to delete a todo item.
- **FR-005**: The todo list MUST persist across page refreshes and session restarts.
- **FR-006**: The system MUST reject empty todo item submissions and display a clear message.
- **FR-007**: The todo list MUST be scoped per engineer (each engineer sees only their own list).
- **FR-008**: The todo list panel MUST be displayed on the main dashboard alongside existing dashboard content.

### Key Entities

- **Todo Item**: A single reminder entry. Has a text description, a completion state (done/not done), and a creation timestamp. Belongs to an engineer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An engineer can add a new todo item in under 10 seconds from opening the dashboard.
- **SC-002**: All todo items are visible immediately after page load without any additional interaction.
- **SC-003**: Todo items and their completion state are fully restored after a page refresh.
- **SC-004**: 100% of submitted todo items appear in the list without requiring a manual refresh.
- **SC-005**: The todo list panel does not disrupt the layout of existing dashboard content.

## Assumptions

- The dashboard already exists and the todo list will be added as a new panel/widget within it.
- Todo items are personal to each engineer and are not shared with others.
- There is no requirement for ordering, prioritising, or categorising todo items in this version.
- Editing a todo item's text after creation is out of scope for this version.
- There is no limit enforced on the number of todo items, but the UI handles long lists gracefully via scrolling.
- The feature targets the engineer persona already defined in the Argus system.
