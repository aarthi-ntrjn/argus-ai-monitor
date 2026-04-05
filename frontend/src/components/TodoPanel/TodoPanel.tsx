import { useState, useRef, useEffect, useCallback } from 'react';
import { useTodos, useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

// A row in the list is either a real DB item or a local draft (not yet saved).
type RowId = string;

function newDraftId() {
  return 'draft-' + crypto.randomUUID();
}

function isDraft(id: RowId) {
  return id.startsWith('draft-');
}

function removeDraftState(
  id: RowId,
  setDraftIds: React.Dispatch<React.SetStateAction<string[]>>,
  setDraftPositions: React.Dispatch<React.SetStateAction<Record<string, number>>>,
) {
  setDraftIds(prev => prev.filter(d => d !== id));
  setDraftPositions(prev => { const n = { ...prev }; delete n[id]; return n; });
}

export default function TodoPanel() {
  const { data: todos = [], isLoading, isError } = useTodos();
  const createTodo = useCreateTodo();
  const updateTodoText = useUpdateTodoText();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  // Only structural state — no per-keystroke state.
  const [draftIds, setDraftIds] = useState<RowId[]>([]);
  const [draftPositions, setDraftPositions] = useState<Record<RowId, number>>({});

  // Seed one blank draft row when the list is empty.
  useEffect(() => {
    if (!isLoading && !isError && todos.length === 0 && draftIds.length === 0) {
      setDraftIds([newDraftId()]);
      setDraftPositions({});
    }
  }, [isLoading, isError, todos.length, draftIds.length]);

  // Build ordered row list: real todos interleaved with draft insertions.
  const orderedRows: Array<{ id: RowId; isDraftRow: boolean }> = [];
  const realTodos = todos;
  let draftsLeft = [...draftIds];
  for (let i = 0; i <= realTodos.length; i++) {
    draftsLeft = draftsLeft.filter(draftId => {
      const pos = draftPositions[draftId] ?? realTodos.length;
      if (pos === i) {
        orderedRows.push({ id: draftId, isDraftRow: true });
        return false;
      }
      return true;
    });
    if (i < realTodos.length) {
      orderedRows.push({ id: realTodos[i].id, isDraftRow: false });
    }
  }
  for (const draftId of draftsLeft) {
    orderedRows.push({ id: draftId, isDraftRow: true });
  }

  const inputRefs = useRef<Array<React.RefObject<HTMLInputElement | null>>>([]);
  if (inputRefs.current.length !== orderedRows.length) {
    inputRefs.current = orderedRows.map((_, i) => inputRefs.current[i] ?? { current: null });
  }

  // Track IDs submitted via Enter so handleBlur doesn't double-save.
  const savingIds = useRef<Set<string>>(new Set());

  const focusRow = useCallback((index: number) => {
    setTimeout(() => {
      inputRefs.current[index]?.current?.focus();
    }, 0);
  }, []);

  // value comes directly from e.target.value — no React state involved.
  const handleBlur = useCallback((id: RowId, value: string) => {
    if (savingIds.current.has(id)) return;
    const text = value.trim();

    if (isDraft(id)) {
      if (text.length === 0) {
        if (orderedRows.length > 1) {
          removeDraftState(id, setDraftIds, setDraftPositions);
        }
      } else {
        savingIds.current.add(id);
        createTodo.mutate(text, {
          onSuccess: () => {
            savingIds.current.delete(id);
            removeDraftState(id, setDraftIds, setDraftPositions);
          },
          onError: () => savingIds.current.delete(id),
        });
      }
      return;
    }

    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    if (text.length === 0) {
      deleteTodo.mutate(id);
    } else if (text !== todo.text) {
      updateTodoText.mutate({ id, text });
    }
  }, [todos, orderedRows.length, createTodo, updateTodoText, deleteTodo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, id: RowId, index: number) => {
    const value = e.currentTarget.value;

    if (e.key === 'Enter') {
      e.preventDefault();
      const text = value.trim();
      const insertPos = index + 1;
      const newId = newDraftId();
      const realCountBefore = orderedRows.slice(0, insertPos).filter(r => !r.isDraftRow).length;

      if (isDraft(id)) {
        if (text.length > 0) {
          savingIds.current.add(id);
          createTodo.mutate(text, {
            onSuccess: () => {
              savingIds.current.delete(id);
              removeDraftState(id, setDraftIds, setDraftPositions);
            },
            onError: () => savingIds.current.delete(id),
          });
        }
      } else {
        const todo = todos.find(t => t.id === id);
        if (todo && text.length > 0 && text !== todo.text) {
          updateTodoText.mutate({ id, text });
        }
      }

      setDraftPositions(prev => ({ ...prev, [newId]: realCountBefore }));
      setDraftIds(prev => [...prev, newId]);
      focusRow(insertPos);

    } else if (e.key === 'Backspace' && value === '') {
      e.preventDefault();
      if (isDraft(id)) {
        removeDraftState(id, setDraftIds, setDraftPositions);
      } else {
        deleteTodo.mutate(id);
      }
      if (index > 0) focusRow(index - 1);
    }
  }, [todos, orderedRows, createTodo, updateTodoText, deleteTodo, focusRow]);

  return (
    <aside className="w-72 shrink-0 flex flex-col bg-white rounded-lg shadow h-fit sticky top-8">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">To Tackle</h2>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
        )}
        {isError && (
          <div className="px-4 py-6 text-center text-sm text-red-500">Failed to load todos.</div>
        )}
        {!isLoading && !isError && (
          <ul className="divide-y divide-gray-50 py-1">
            {orderedRows.map(({ id, isDraftRow }, index) => {
              const todo = isDraftRow ? null : todos.find(t => t.id === id);
              const done = todo?.done ?? false;

              if (!inputRefs.current[index]) {
                inputRefs.current[index] = { current: null };
              }

              return (
                <li key={id} className="group flex items-center gap-2 px-4 py-1">
                  <input
                    type="checkbox"
                    checked={done}
                    disabled={isDraftRow}
                    aria-label={isDraftRow ? undefined : `Mark "${todo?.text ?? ''}" as ${done ? 'incomplete' : 'complete'}`}
                    onChange={() => todo && toggleTodo.mutate({ id, done: !done })}
                    className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer disabled:opacity-30"
                  />
                  <input
                    ref={inputRefs.current[index] as React.RefObject<HTMLInputElement>}
                    type="text"
                    defaultValue={todo?.text ?? ''}
                    onBlur={e => handleBlur(id, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, id, index)}
                    placeholder="Add a task…"
                    aria-label={isDraftRow ? 'New task' : `Edit task: ${todo?.text ?? ''}`}
                    className={`flex-1 min-w-0 text-sm bg-transparent border-none outline-none focus:ring-0 placeholder-gray-300 ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}
                  />
                  <button
                    onClick={() => isDraft(id) ? removeDraftState(id, setDraftIds, setDraftPositions) : deleteTodo.mutate(id)}
                    aria-label={`Delete "${todo?.text ?? 'task'}"`}
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-gray-300 hover:text-red-500 transition-opacity p-0.5 rounded"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

