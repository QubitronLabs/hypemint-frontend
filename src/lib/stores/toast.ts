import { writable, derived } from "svelte/store";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration: number;
}

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);
  let nextId = 1;

  function add(message: string, type: Toast["type"] = "info", duration = 3000) {
    const id = nextId++;
    const toast: Toast = { id, message, type, duration };

    update((toasts) => [...toasts, toast]);

    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }

    return id;
  }

  function remove(id: number) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  function clear() {
    update(() => []);
  }

  return {
    subscribe,
    add,
    remove,
    clear,
    success: (msg: string, duration?: number) => add(msg, "success", duration),
    error: (msg: string, duration?: number) => add(msg, "error", duration),
    info: (msg: string, duration?: number) => add(msg, "info", duration),
    warning: (msg: string, duration?: number) => add(msg, "warning", duration),
  };
}

export const toasts = createToastStore();
