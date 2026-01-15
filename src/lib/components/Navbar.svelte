<script lang="ts">
  import { isConnected, shortAddress, isAuthenticated } from '$lib/stores'
  import WalletButton from './WalletButton.svelte'
  import { Zap, Coins, BarChart3, Plus, User, Menu, X } from 'lucide-svelte'

  let mobileMenuOpen = $state(false)
</script>

<nav class="navbar">
  <div class="container nav-content">
    <a href="/" class="logo">
      <div class="logo-icon">
        <Zap size={22} />
      </div>
      <span class="logo-text">HypeMint</span>
    </a>

    <div class="nav-links">
      <a href="/tokens" class="nav-link">
        <Coins size={18} />
        <span>Tokens</span>
      </a>
      <a href="/trades" class="nav-link">
        <BarChart3 size={18} />
        <span>Trades</span>
      </a>
      {#if $isAuthenticated}
        <a href="/tokens/create" class="nav-link create-link">
          <Plus size={18} />
          <span>Create</span>
        </a>
      {/if}
    </div>

    <div class="nav-right">
      {#if $isAuthenticated}
        <a href="/profile" class="profile-link">
          <User size={16} />
          <span>{$shortAddress}</span>
        </a>
      {/if}
      <WalletButton />
      <button class="mobile-menu-btn" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
        {#if mobileMenuOpen}
          <X size={24} />
        {:else}
          <Menu size={24} />
        {/if}
      </button>
    </div>
  </div>

  {#if mobileMenuOpen}
    <div class="mobile-menu">
      <a href="/tokens" onclick={() => mobileMenuOpen = false}>
        <Coins size={18} />
        <span>Tokens</span>
      </a>
      <a href="/trades" onclick={() => mobileMenuOpen = false}>
        <BarChart3 size={18} />
        <span>Trades</span>
      </a>
      {#if $isAuthenticated}
        <a href="/tokens/create" onclick={() => mobileMenuOpen = false}>
          <Plus size={18} />
          <span>Create Token</span>
        </a>
        <a href="/profile" onclick={() => mobileMenuOpen = false}>
          <User size={18} />
          <span>Profile</span>
        </a>
      {/if}
    </div>
  {/if}
</nav>

<style>
  .navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 70px;
    background: rgba(10, 10, 15, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    z-index: 50;
  }

  .nav-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    text-decoration: none;
  }

  .logo-icon {
    width: 36px;
    height: 36px;
    background: var(--gradient-1);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .nav-links {
    display: flex;
    gap: 0.5rem;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.9rem;
    border-radius: 10px;
    transition: all 0.2s ease;
  }

  .nav-link:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-link.create-link {
    background: rgba(139, 92, 246, 0.1);
    color: var(--accent);
  }

  .nav-link.create-link:hover {
    background: rgba(139, 92, 246, 0.2);
  }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .profile-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: var(--bg-tertiary);
    border-radius: 10px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.8rem;
    font-family: 'JetBrains Mono', monospace;
    border: 1px solid var(--border);
    transition: all 0.2s ease;
  }

  .profile-link:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  .mobile-menu-btn {
    display: none;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .mobile-menu-btn:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  .mobile-menu {
    display: none;
    position: absolute;
    top: 70px;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    padding: 1rem;
  }

  .mobile-menu a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    color: var(--text-secondary);
    text-decoration: none;
    border-radius: 10px;
    transition: all 0.2s;
  }

  .mobile-menu a:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }

  @media (max-width: 768px) {
    .nav-links { display: none; }
    .profile-link { display: none; }
    .mobile-menu-btn { display: flex; }
    .mobile-menu { display: block; }
  }
</style>
