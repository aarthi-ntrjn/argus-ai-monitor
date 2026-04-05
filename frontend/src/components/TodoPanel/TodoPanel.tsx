import { useState, useRef, useCallback } from 'react';
import { useTodos, useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

type RowId = string;

function newDraftId() {
  return 'draft-' + crypto.randomUUID();
}

function isDraft(id: RowId) {
  return id.startsWith('draft-');
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
  const resetAddRow = useCallback(() => setAddRowId(newDraftId()), []);

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
    <aside className="w-72 shrink-0 flex flex-col bg-white rounded-lg shadow h-fit sticky top-8">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 tracking-wide uppercase">To Tackle</h2>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-12rem)]">
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
            {todos.map((todo, index) => {
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
                  <button
                    onClick={() => deleteTodo.mutate(todo.id)}
                    aria-label={`Delete "${todo.text}"`}
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
