import { useState, useRef, useCallback, useEffect } from 'react';
import { useTodos, useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

type RowId = string;

function newDraftId() {
  return 'draft-' + crypto.randomUUID();
}

function isDraft(id: RowId) {
  return id.startsWith('draft-');
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TodoPanel() {
  const { data: todos = [], isLoading, isError } = useTodos();
  const createTodo = useCreateTodo();
  const updateTodoText = useUpdateTodoText();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  // Single persistent add row at the bottom. Changing the ID unmounts/remounts
  // the input (resetting it to empty) without any visible flicker.
  const [addRowId, setAddRowId] = useState(() => newDraftId());
  const shouldFocusAdd = useRef(false);
  const resetAddRow = useCallback(() => {
    shouldFocusAdd.current = true;
    setAddRowId(newDraftId());
  }, []);

  // After remount (key change), focus the new input
  useEffect(() => {
    if (shouldFocusAdd.current) {
      shouldFocusAdd.current = false;
      addRowRef.current?.focus();
    }
  }, [addRowId]);

  const [showDone, setShowDone] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);

  // Track IDs submitted via Enter so handleBlur doesn't double-save.
  const savingIds = useRef<Set<string>>(new Set());

  const addRowRef = useRef<HTMLInputElement>(null);
  const todoRefs = useRef<Array<React.RefObject<HTMLInputElement | null>>>([]);
  if (todoRefs.current.length !== todos.length) {
    todoRefs.current = todos.map((_, i) => todoRefs.current[i] ?? { current: null });
  }

  const focusAddRow = useCallback(() => {
    setTimeout(() => { addRowRef.current?.focus(); }, 0);
  }, []);

  const focusRow = useCallback((index: number) => {
    // index 0 = add row, index 1+ = todos[index-1]
    if (index === 0) {
      setTimeout(() => { addRowRef.current?.focus(); }, 0);
    } else {
      setTimeout(() => { todoRefs.current[index - 1]?.current?.focus(); }, 0);
    }
  }, []);

  const handleBlur = useCallback((id: RowId, value: string) => {
    if (savingIds.current.has(id)) return;
    const text = value.trim();

    if (isDraft(id)) {
      if (text.length > 0) {
        savingIds.current.add(id);
        createTodo.mutate(text, {
          onSuccess: () => { savingIds.current.delete(id); resetAddRow(); },
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
  }, [todos, createTodo, updateTodoText, deleteTodo, resetAddRow]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, id: RowId, index: number) => {
    const value = e.currentTarget.value;

    if (e.key === 'Enter') {
      e.preventDefault();
      const text = value.trim();

      if (isDraft(id)) {
        if (text.length > 0) {
          savingIds.current.add(id);
          createTodo.mutate(text, {
            onSuccess: () => { savingIds.current.delete(id); resetAddRow(); },
            onError: () => savingIds.current.delete(id),
          });
        }
      } else {
        const todo = todos.find(t => t.id === id);
        if (todo && text.length > 0 && text !== todo.text) {
          updateTodoText.mutate({ id, text });
        }
        focusAddRow();
      }

    } else if (e.key === 'Backspace' && value === '') {
      e.preventDefault();
      if (!isDraft(id)) {
        deleteTodo.mutate(id);
      }
      if (index > 0) focusRow(index - 1);
    }
  }, [todos, createTodo, updateTodoText, deleteTodo, resetAddRow, focusAddRow, focusRow]);

  return (
    <aside className="w-full flex flex-col bg-white rounded-lg shadow h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide">To Tackle</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTimestamps(v => !v)}
            title={showTimestamps ? 'Hide timestamps' : 'Show timestamps'}
            className={`p-1 rounded transition-colors ${showTimestamps ? 'text-blue-400 hover:text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => setShowDone(v => !v)}
            title={showDone ? 'Hide completed' : 'Show completed'}
            className={`p-1 rounded transition-colors ${showDone ? 'text-blue-400 hover:text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add row always visible regardless of loading state */}
        <div
          className="flex items-center gap-2 px-4 py-1 border-b border-gray-50 cursor-text"
          onClick={() => addRowRef.current?.focus()}
        >
          <span className="h-4 w-4 shrink-0 flex items-center justify-center text-blue-400 text-base leading-none select-none">+</span>
          <input
            key={addRowId}
            ref={addRowRef}
            type="text"
            defaultValue=""
            onBlur={e => handleBlur(addRowId, e.target.value)}
            onKeyDown={e => handleKeyDown(e, addRowId, 0)}
            placeholder="Add a task…"
            aria-label="New task"
            className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none focus:ring-0 text-gray-700 placeholder-gray-400"
          />
        </div>

        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
        )}
        {isError && (
          <div className="px-4 py-6 text-center text-sm text-red-500">Failed to load todos.</div>
        )}
        {!isLoading && !isError && todos.length > 0 && (
          <ul className="divide-y divide-gray-50 py-1">
            {[...todos].reverse().filter(todo => showDone || !todo.done).map((todo, index) => {
              if (!todoRefs.current[index]) {
                todoRefs.current[index] = { current: null };
              }
              const done = todo.done;
              return (
                <li key={todo.id} className="group flex items-center gap-2 px-4 py-1">
                  <input
                    type="checkbox"
                    checked={done}
                    aria-label={`Mark "${todo.text}" as ${done ? 'incomplete' : 'complete'}`}
                    onChange={() => toggleTodo.mutate({ id: todo.id, done: !done })}
                    className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 cursor-pointer"
                  />
                  <input
                    ref={todoRefs.current[index] as React.RefObject<HTMLInputElement>}
                    type="text"
                    defaultValue={todo.text}
                    onBlur={e => handleBlur(todo.id, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, todo.id, index + 1)}
                    aria-label={`Edit task: ${todo.text}`}
                    className={`flex-1 min-w-0 text-sm bg-transparent border-none outline-none focus:ring-0 ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}
                  />
                  <div className="relative shrink-0">
                    {showTimestamps ? (
                      <span className="block text-xs text-gray-300 whitespace-nowrap group-hover:opacity-0 transition-opacity">
                        {formatRelativeTime(todo.createdAt)}
                      </span>
                    ) : (
                      <span className="block w-3.5 h-3.5 opacity-0" />
                    )}
                    <button
                      onClick={() => deleteTodo.mutate(todo.id)}
                      aria-label={`Delete "${todo.text}"`}
                      className="absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
