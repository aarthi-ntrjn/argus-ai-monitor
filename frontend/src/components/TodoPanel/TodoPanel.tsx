import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTodos, useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';
import ToggleIconButton from '../ToggleIconButton';
import { Checkbox } from '../Checkbox';
import type { TodoItem } from '../../types';

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
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface TodoRowProps {
  todo: TodoItem;
  index: number;
  reversedTodos: TodoItem[];
  wrapText: boolean;
  showTimestamps: boolean;
  todoRefsMap: React.MutableRefObject<Map<string, HTMLTextAreaElement | null>>;
  onBlur: (id: string, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, id: string, index: number, reversedTodos?: TodoItem[]) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, done: boolean) => void;
}

function TodoRow({ todo, index, reversedTodos, wrapText, showTimestamps, todoRefsMap, onBlur, onKeyDown, onDelete, onToggle }: TodoRowProps) {
  const { done } = todo;
  return (
    <li key={todo.id} className="group flex items-center gap-2 px-4 py-[3px]">
      <Checkbox
        checked={done}
        onChange={() => onToggle(todo.id, done)}
        aria-label={`Mark "${todo.text}" as ${done ? 'incomplete' : 'complete'}`}
      />
      <textarea
        ref={(el) => {
          todoRefsMap.current.set(todo.id, el);
          if (el && wrapText) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          } else if (el) {
            el.style.height = '1.25rem';
          }
        }}
        defaultValue={todo.text}
        onBlur={e => onBlur(todo.id, e.target.value)}
        onKeyDown={e => onKeyDown(e, todo.id, index + 1, reversedTodos)}
        onInput={e => {
          if (wrapText) {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          }
        }}
        aria-label={`Edit task: ${todo.text}`}
        rows={1}
        className={`flex-1 min-w-0 text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white rounded resize-none leading-snug ${done ? 'line-through text-gray-500' : 'text-gray-700'}`}
        style={wrapText ? { overflow: 'hidden' } : { height: '1.25rem', overflow: 'hidden', whiteSpace: 'nowrap' }}
      />
      <div className="relative shrink-0 group/del">
        {showTimestamps ? (
          <span className="block text-xs text-gray-500 whitespace-nowrap group-hover:opacity-0 group-focus-within/del:opacity-0 transition-opacity">
            {formatRelativeTime(todo.createdAt)}
          </span>
        ) : (
          <span className="block w-3.5 h-3.5 opacity-0" />
        )}
        <button
          onClick={() => onDelete(todo.id)}
          aria-label={`Delete "${todo.text}"`}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within/del:opacity-100 text-gray-500 hover:text-red-500 transition-opacity focus:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 rounded-sm"
        >
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </li>
  );
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

  const [showDone, setShowDone] = useState(() => {
    const v = localStorage.getItem('argus.todo.showDone');
    return v === null ? true : v === 'true';
  });
  const [showTimestamps, setShowTimestamps] = useState(() => {
    const v = localStorage.getItem('argus.todo.showTimestamps');
    return v === null ? true : v === 'true';
  });
  const [wrapText, setWrapText] = useState(() => {
    const v = localStorage.getItem('argus.todo.wrapText');
    return v === null ? false : v === 'true';
  });

  useEffect(() => { localStorage.setItem('argus.todo.showDone', String(showDone)); }, [showDone]);
  useEffect(() => { localStorage.setItem('argus.todo.showTimestamps', String(showTimestamps)); }, [showTimestamps]);
  useEffect(() => { localStorage.setItem('argus.todo.wrapText', String(wrapText)); }, [wrapText]);

  const reversedTodos = useMemo(
    () => [...todos].reverse().filter(todo => showDone || !todo.done),
    [todos, showDone]
  );

  // Track IDs submitted via Enter so handleBlur doesn't double-save.
  const savingIds = useRef<Set<string>>(new Set());

  const addRowRef = useRef<HTMLInputElement>(null);
  const todoRefsMap = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());

  const focusAddRow = useCallback(() => {
    setTimeout(() => { addRowRef.current?.focus(); }, 0);
  }, []);

  const focusRow = useCallback((index: number, reversedTodos: typeof todos) => {
    if (index === 0) {
      setTimeout(() => { addRowRef.current?.focus(); }, 0);
    } else {
      const target = reversedTodos[index - 1];
      if (target) setTimeout(() => { todoRefsMap.current.get(target.id)?.focus(); }, 0);
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, id: RowId, index: number, reversedTodos: typeof todos = []) => {
    const value = e.currentTarget.value;

    if (e.key === 'Enter' && !e.shiftKey) {
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
      if (index > 0) focusRow(index - 1, reversedTodos);
    }
  }, [todos, createTodo, updateTodoText, deleteTodo, resetAddRow, focusAddRow, focusRow]);

  return (
    <aside data-tour-id="dashboard-todo" className="w-full h-full flex flex-col bg-white rounded-lg shadow border border-gray-200 max-h-[calc(100vh-6rem)]">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">To Do or Not To Do</span>
        <div className="flex items-center gap-1">
          <ToggleIconButton pressed={wrapText} onToggle={() => setWrapText(v => !v)} label={wrapText ? 'Single line' : 'Wrap text'}>
            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10a3 3 0 010 6h-3m3-6l2 2-2 2" />
            </svg>
          </ToggleIconButton>
          <ToggleIconButton pressed={showTimestamps} onToggle={() => setShowTimestamps(v => !v)} label={showTimestamps ? 'Hide timestamps' : 'Show timestamps'}>
            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </ToggleIconButton>
          <ToggleIconButton pressed={showDone} onToggle={() => setShowDone(v => !v)} label={showDone ? 'Hide completed' : 'Show completed'}>
            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </ToggleIconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Add row always visible regardless of loading state */}
        <div
          className="flex items-center gap-2 px-4 py-2 border-b border-gray-50 cursor-text"
          onClick={() => addRowRef.current?.focus()}
        >
          <span aria-hidden="true" className="h-4 w-4 shrink-0 flex items-center justify-center text-blue-600 text-base leading-none select-none">+</span>
          <input
            key={addRowId}
            ref={addRowRef}
            type="text"
            defaultValue=""
            onBlur={e => handleBlur(addRowId, e.target.value)}
            onKeyDown={e => handleKeyDown(e, addRowId, 0)}
            placeholder="Add a task…"
            aria-label="New task"
            className="flex-1 min-w-0 text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 placeholder-gray-400"
          />
        </div>

        {isLoading && (
          <div className="px-4 py-6 text-center text-sm text-gray-500">Loading…</div>
        )}
        {isError && (
          <div className="px-4 py-6 text-center text-sm text-red-600">Failed to load todos.</div>
        )}
        {!isLoading && !isError && todos.length > 0 && (
          <ul className="divide-y divide-gray-50 py-1">
            {reversedTodos.map((todo, index) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                index={index}
                reversedTodos={reversedTodos}
                wrapText={wrapText}
                showTimestamps={showTimestamps}
                todoRefsMap={todoRefsMap}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onDelete={(id) => deleteTodo.mutate(id)}
                onToggle={(id, done) => toggleTodo.mutate({ id, done: !done })}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
