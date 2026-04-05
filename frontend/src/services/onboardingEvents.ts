// Analytics event hook points — v1 stubs (FR-013).
// Wire these to a real analytics provider in a future feature
// without changing any call sites.

export const onTourStarted = (_trigger: 'auto' | 'manual'): void => {};

export const onTourCompleted = (): void => {};

export const onTourSkipped = (_atStep: number, _reason: 'user_action' | 'navigation'): void => {};

export const onStepAdvanced = (_fromStep: number, _toStep: number): void => {};

export const onHintViewed = (_hintId: string): void => {};

export const onHintDismissed = (_hintId: string): void => {};
