import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement scrollIntoView — polyfill it so components that
// call bottomRef.current?.scrollIntoView() don't throw in tests.
Element.prototype.scrollIntoView = vi.fn();
