<script lang="ts">
  import { toasts, type Toast } from '$lib/stores/toast'
</script>

{#if $toasts.length > 0}
  <div class="toast-container" role="region" aria-label="Notifications">
    {#each $toasts as toast (toast.id)}
      <div class="toast toast-{toast.type}">
        <span class="toast-icon">
          {#if toast.type === 'success'}✓
          {:else if toast.type === 'error'}✕
          {:else if toast.type === 'warning'}⚠
          {:else}ℹ
          {/if}
        </span>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-close" onclick={() => toasts.remove(toast.id)} aria-label="Dismiss notification">×</button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    z-index: 200;
    max-width: 400px;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-success { border-color: var(--success); }
  .toast-error { border-color: var(--error); }
  .toast-warning { border-color: var(--warning); }
  .toast-info { border-color: var(--info); }

  .toast-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: bold;
  }

  .toast-success .toast-icon { background: var(--success); }
  .toast-error .toast-icon { background: var(--error); }
  .toast-warning .toast-icon { background: var(--warning); }
  .toast-info .toast-icon { background: var(--info); }

  .toast-message { flex: 1; font-size: 0.875rem; }

  .toast-close {
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1rem;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .toast-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
</style>
