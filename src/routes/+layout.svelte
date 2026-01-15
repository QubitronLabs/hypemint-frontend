<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import { browser } from '$app/environment'
  import { initWallet, setupWalletListeners } from '$lib/stores/wallet'
  import { initAuth } from '$lib/stores/auth'
  import Navbar from '$lib/components/Navbar.svelte'
  import Toast from '$lib/components/Toast.svelte'

  let { children } = $props()

  onMount(() => {
    if (browser) {
      initWallet()
      initAuth()
      setupWalletListeners()
    }
  })
</script>

<svelte:head>
  <title>HypeMint - Token Launch Platform</title>
  <meta name="description" content="Launch and trade meme tokens with bonding curves on Polygon" />
</svelte:head>

<div class="app">
  <Navbar />
  <main>
    {@render children()}
  </main>
  <Toast />
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  main {
    flex: 1;
    padding-top: 80px;
  }
</style>
