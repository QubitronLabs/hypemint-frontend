<script lang="ts">
  import { goto } from '$app/navigation'
  import { isAuthenticated, wallet } from '$lib/stores'
  import { toasts } from '$lib/stores/toast'
  import { api } from '$lib/services/api'
  import { blockchain } from '$lib/contracts'
  import { getContractConfig, DEFAULT_CHAIN_ID } from '$lib/contracts/config'
  import { onMount } from 'svelte'
  import { Rocket, Image, Link, Globe, Twitter, Send, ChevronLeft, Check, Loader2, AlertCircle, ExternalLink } from 'lucide-svelte'

  let formData = $state({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    telegramUrl: '',
  })

  let loading = $state(false)
  let errors: Record<string, string> = $state({})
  let creationFee = $state('0.001')
  let step = $state<'form' | 'confirm' | 'creating' | 'success'>('form')
  let createdToken = $state<{id: string, address: string, txHash?: string} | null>(null)
  let hasContractDeployed = $state(false)

  onMount(async () => {
    // Check if contract is deployed on Polygon Mainnet
    const config = getContractConfig(DEFAULT_CHAIN_ID)
    hasContractDeployed = !!config?.TokenFactory?.address

    if (hasContractDeployed) {
      try {
        creationFee = await blockchain.getCreationFee()
      } catch (err) {
        console.error('Failed to get creation fee:', err)
      }
    }
  })

  function validate(): boolean {
    errors = {}

    if (!formData.name.trim()) errors.name = 'Name is required'
    else if (formData.name.length < 2) errors.name = 'Name must be at least 2 characters'
    else if (formData.name.length > 50) errors.name = 'Name must be less than 50 characters'

    if (!formData.symbol.trim()) errors.symbol = 'Symbol is required'
    else if (formData.symbol.length < 2) errors.symbol = 'Symbol must be at least 2 characters'
    else if (formData.symbol.length > 10) errors.symbol = 'Symbol must be less than 10 characters'
    else if (!/^[A-Z0-9]+$/.test(formData.symbol.toUpperCase())) 
      errors.symbol = 'Symbol must be alphanumeric'

    if (formData.description.length > 500) errors.description = 'Description must be less than 500 characters'

    return Object.keys(errors).length === 0
  }

  async function handleSubmit() {
    if (!$isAuthenticated) {
      toasts.warning('Please connect wallet and sign in')
      return
    }

    if (!validate()) return

    step = 'confirm'
  }

  async function confirmCreate() {
    if (!$isAuthenticated || !$wallet.address) {
      toasts.warning('Please connect wallet')
      return
    }

    loading = true
    step = 'creating'

    try {
      // Try blockchain creation first if contract is deployed
      if (hasContractDeployed) {
        const result = await blockchain.createToken({
          name: formData.name,
          symbol: formData.symbol.toUpperCase(),
          description: formData.description,
          imageUrl: formData.imageUrl || '',
          twitterUrl: formData.twitterUrl,
          telegramUrl: formData.telegramUrl,
          websiteUrl: formData.websiteUrl
        })

        // Also create in backend database
        const backendResult = await api.tokens.create({
          name: formData.name,
          symbol: formData.symbol.toUpperCase(),
          description: formData.description,
          imageUrl: formData.imageUrl,
          websiteUrl: formData.websiteUrl,
          twitterUrl: formData.twitterUrl,
          telegramUrl: formData.telegramUrl,
          chainId: 137, // Polygon Mainnet
          contractAddress: result.tokenAddress,
          curveAddress: result.curveAddress
        })

        createdToken = {
          id: backendResult.success ? backendResult.data?.id : result.tokenAddress,
          address: result.tokenAddress,
          txHash: result.txHash
        }
      } else {
        // Fallback to backend-only creation (for testing)
        const result = await api.tokens.create({
          name: formData.name,
          symbol: formData.symbol.toUpperCase(),
          description: formData.description,
          imageUrl: formData.imageUrl,
          websiteUrl: formData.websiteUrl,
          twitterUrl: formData.twitterUrl,
          telegramUrl: formData.telegramUrl,
          chainId: 137 // Polygon Mainnet
        })

        if (!result.success) {
          throw new Error(result.error?.message || 'Failed to create token')
        }

        createdToken = {
          id: result.data?.id || '1',
          address: result.data?.contractAddress || ''
        }
      }

      step = 'success'
      toasts.success('Token created successfully!')
    } catch (err: any) {
      console.error('Token creation failed:', err)
      toasts.error(err.message || 'Failed to create token')
      step = 'form'
    } finally {
      loading = false
    }
  }

  function goBack() {
    step = 'form'
  }

  function viewToken() {
    if (createdToken) {
      goto(`/tokens/${createdToken.id}`)
    }
  }

  const totalCost = $derived(() => {
    const fee = parseFloat(creationFee) || 0.001
    return fee.toFixed(4)
  })
</script>

<svelte:head>
  <title>Create Token | HypeMint</title>
</svelte:head>

<div class="container">
  <div class="create-page">
    {#if step === 'form'}
      <div class="page-header">
        <div class="header-icon">
          <Rocket size={28} />
        </div>
        <h1>Launch Your Token</h1>
        <p>Create a token with automated bonding curve pricing. Fair launch, no presale.</p>
      </div>

      <form class="create-form card" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <!-- Basic Info Section -->
        <div class="form-section">
          <div class="section-header">
            <div class="section-icon-wrap"><Image size={18} /></div>
            <h3>Basic Information</h3>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="name">Token Name *</label>
              <input 
                id="name"
                type="text" 
                placeholder="e.g., Doge Moon"
                bind:value={formData.name}
                class:error={errors.name}
              />
              {#if errors.name}
                <span class="error-text">{errors.name}</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="symbol">Symbol *</label>
              <input 
                id="symbol"
                type="text" 
                placeholder="e.g., DGMN"
                bind:value={formData.symbol}
                class:error={errors.symbol}
                style="text-transform: uppercase"
                maxlength="10"
              />
              {#if errors.symbol}
                <span class="error-text">{errors.symbol}</span>
              {/if}
            </div>
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea 
              id="description"
              placeholder="Tell us about your token..."
              bind:value={formData.description}
              rows="4"
              maxlength="500"
            ></textarea>
            <span class="char-count">{formData.description.length}/500</span>
          </div>

          <div class="form-group">
            <label for="imageUrl">Image URL</label>
            <input 
              id="imageUrl"
              type="url" 
              placeholder="https://example.com/image.png"
              bind:value={formData.imageUrl}
            />
            {#if formData.imageUrl}
              <div class="image-preview">
                <img src={formData.imageUrl} alt="Token preview" onerror={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
              </div>
            {/if}
          </div>
        </div>



        <!-- Social Links Section -->
        <div class="form-section">
          <div class="section-header">
            <div class="section-icon-wrap"><Link size={18} /></div>
            <h3>Social Links (Optional)</h3>
          </div>
          
          <div class="form-group">
            <label for="website">Website</label>
            <input id="website" type="url" placeholder="https://yourproject.com" bind:value={formData.websiteUrl} />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="twitter">Twitter / X</label>
              <input id="twitter" type="url" placeholder="https://x.com/yourproject" bind:value={formData.twitterUrl} />
            </div>
            <div class="form-group">
              <label for="telegram">Telegram</label>
              <input id="telegram" type="url" placeholder="https://t.me/yourproject" bind:value={formData.telegramUrl} />
            </div>
          </div>
        </div>

        <!-- Cost Summary -->
        <div class="cost-summary">
          <div class="cost-row total">
            <span>Creation Fee</span>
            <span>{creationFee} POL</span>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg" disabled={loading || !$isAuthenticated}>
            {#if loading}
              <Loader2 size={18} class="spin" />
              <span>Creating...</span>
            {:else if !$isAuthenticated}
              Connect Wallet to Create
            {:else}
              <span>Continue</span>
              <ChevronLeft size={18} style="transform: rotate(180deg)" />
            {/if}
          </button>
        </div>
      </form>

    {:else if step === 'confirm'}
      <div class="confirm-card card">
        <div class="confirm-header">
          <h2>Confirm Token Creation</h2>
          <p>Review your token details before creating</p>
        </div>

        <div class="confirm-details">
          <div class="detail-row">
            <span class="label">Name</span>
            <span class="value">{formData.name}</span>
          </div>
          <div class="detail-row">
            <span class="label">Symbol</span>
            <span class="value">${formData.symbol.toUpperCase()}</span>
          </div>
          {#if formData.description}
            <div class="detail-row">
              <span class="label">Description</span>
              <span class="value desc">{formData.description}</span>
            </div>
          {/if}
          <div class="detail-row highlight">
            <span class="label">Total Cost</span>
            <span class="value">{totalCost()} POL</span>
          </div>
        </div>

        <div class="confirm-notice">
          <AlertCircle size={18} class="notice-icon" />
          <p>This action cannot be undone. Make sure all details are correct.</p>
        </div>

        <div class="confirm-actions">
          <button class="btn btn-secondary" onclick={goBack} disabled={loading}>
            <ChevronLeft size={18} />
            <span>Back</span>
          </button>
          <button class="btn btn-primary" onclick={confirmCreate} disabled={loading}>
            {#if loading}
              <Loader2 size={18} class="spin" />
              <span>Creating...</span>
            {:else}
              <Rocket size={18} />
              <span>Create Token</span>
            {/if}
          </button>
        </div>
      </div>

    {:else if step === 'creating'}
      <div class="creating-card card">
        <div class="creating-animation">
          <Loader2 size={48} class="spin" />
        </div>
        <h2>Creating Your Token</h2>
        <p>Please confirm the transaction in your wallet...</p>
        <div class="steps-progress">
          <div class="step-item active">
            <span class="step-icon"><Check size={16} /></span>
            <span>Preparing transaction</span>
          </div>
          <div class="step-item active">
            <span class="step-icon"><Loader2 size={16} class="spin" /></span>
            <span>Deploying token contract</span>
          </div>
          <div class="step-item">
            <span class="step-icon pending"></span>
            <span>Confirming on blockchain</span>
          </div>
        </div>
      </div>

    {:else if step === 'success'}
      <div class="success-card card">
        <div class="success-animation">
          <Check size={48} />
        </div>
        <h2>Token Created!</h2>
        <p>Your token has been successfully launched.</p>
        
        {#if createdToken}
          <div class="token-info">
            <div class="info-row">
              <span>Token</span>
              <span class="token-name">{formData.name} (${formData.symbol})</span>
            </div>
            {#if createdToken.address}
              <div class="info-row">
                <span>Contract</span>
                <a href="https://polygonscan.com/address/{createdToken.address}" target="_blank" rel="noopener">
                  {createdToken.address.slice(0, 6)}...{createdToken.address.slice(-4)}
                  <ExternalLink size={14} />
                </a>
              </div>
            {/if}
            {#if createdToken.txHash}
              <div class="info-row">
                <span>Transaction</span>
                <a href="https://polygonscan.com/tx/{createdToken.txHash}" target="_blank" rel="noopener">
                  View on Polygonscan
                  <ExternalLink size={14} />
                </a>
              </div>
            {/if}
          </div>
        {/if}

        <div class="success-actions">
          <button class="btn btn-primary" onclick={viewToken}>
            <span>View Token Page</span>
            <ChevronLeft size={18} style="transform: rotate(180deg)" />
          </button>
          <a href="/tokens/create" class="btn btn-secondary">
            Create Another Token
          </a>
        </div>
      </div>
    {/if}

    <!-- How It Works -->
    <div class="how-it-works">
      <h3>How Bonding Curves Work</h3>
      <div class="steps-grid">
        <div class="step-card">
          <span class="step-num">1</span>
          <h4>Create Token</h4>
          <p>Launch your token with no presale. Everyone buys on the same curve.</p>
        </div>
        <div class="step-card">
          <span class="step-num">2</span>
          <h4>Price Discovery</h4>
          <p>Price increases as more tokens are bought. Early buyers get better prices.</p>
        </div>
        <div class="step-card">
          <span class="step-num">3</span>
          <h4>Graduation</h4>
          <p>At $69K market cap, liquidity is added to DEX and trading continues.</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .create-page { 
    max-width: 680px; 
    margin: 0 auto; 
    padding: 2rem 0 4rem; 
  }

  .page-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header-icon {
    width: 72px;
    height: 72px;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    margin-bottom: 1.25rem;
  }

  .page-header h1 { 
    font-size: 2rem; 
    margin-bottom: 0.5rem;
    background: var(--gradient-1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .page-header p { 
    color: var(--text-secondary); 
    max-width: 400px;
    margin: 0 auto;
  }

  .create-form { 
    padding: 2rem;
    border-radius: 20px;
  }

  .form-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border);
  }

  .form-section:last-of-type { 
    border-bottom: none; 
    margin-bottom: 1rem; 
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .section-icon-wrap { 
    width: 36px;
    height: 36px;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
  }
  
  .section-header h3 { margin: 0; font-size: 1.125rem; }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group { 
    margin-bottom: 1rem; 
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  input, textarea {
    width: 100%;
    padding: 0.875rem 1rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--text-primary);
    font-size: 1rem;
    transition: all 0.2s;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  input.error, textarea.error { 
    border-color: var(--error); 
  }

  .error-text { 
    color: var(--error); 
    font-size: 0.75rem; 
    margin-top: 0.375rem;
    display: block;
  }

  .char-count { 
    font-size: 0.75rem; 
    color: var(--text-muted); 
    text-align: right; 
    display: block;
    margin-top: 0.25rem;
  }

  .input-with-suffix {
    position: relative;
  }

  .input-with-suffix input {
    padding-right: 4rem;
  }

  .input-with-suffix .suffix {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .image-preview {
    margin-top: 0.75rem;
    width: 80px;
    height: 80px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .image-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cost-summary {
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .cost-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .cost-row.total {
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
    padding-top: 0.75rem;
    font-weight: 600;
    font-size: 1rem;
    color: var(--text);
  }

  .form-actions { padding-top: 0.5rem; }
  .form-actions button { width: 100%; }

  /* Confirm Step */
  .confirm-card {
    padding: 2rem;
    text-align: center;
  }

  .confirm-header {
    margin-bottom: 2rem;
  }

  .confirm-header h2 { margin-bottom: 0.5rem; }
  .confirm-header p { color: var(--text-muted); }

  .confirm-details {
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 1rem;
    margin-bottom: 1.5rem;
    text-align: left;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border);
  }

  .detail-row:last-child { border-bottom: none; }
  .detail-row .label { color: var(--text-muted); }
  .detail-row .value { font-weight: 500; }
  .detail-row .value.desc { 
    max-width: 300px; 
    text-align: right;
    font-size: 0.875rem;
  }

  .detail-row.highlight {
    background: rgba(139, 92, 246, 0.1);
    border-radius: var(--radius-sm);
    padding: 0.75rem;
    margin-top: 0.5rem;
  }

  .confirm-notice {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.2);
    border-radius: var(--radius-sm);
    padding: 1rem;
    margin-bottom: 1.5rem;
    text-align: left;
  }

  .confirm-notice .icon { font-size: 1.25rem; }
  .confirm-notice p { font-size: 0.875rem; color: var(--text-secondary); margin: 0; }

  .confirm-actions {
    display: flex;
    gap: 1rem;
  }

  .confirm-actions button {
    flex: 1;
  }

  /* Creating Step */
  .creating-card {
    padding: 3rem 2rem;
    text-align: center;
  }

  .creating-animation {
    margin-bottom: 2rem;
  }

  .creating-card h2 { margin-bottom: 0.5rem; }
  .creating-card > p { color: var(--text-muted); margin-bottom: 2rem; }

  .steps-progress {
    max-width: 300px;
    margin: 0 auto;
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .step-item.active { color: var(--text); }
  .step-item .step-icon { width: 20px; text-align: center; }

  /* Success Step */
  .success-card {
    padding: 3rem 2rem;
    text-align: center;
  }

  .success-animation {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: bounce 0.5s ease;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }

  .success-card h2 { 
    margin-bottom: 0.5rem;
    background: var(--gradient-1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .success-card > p { color: var(--text-muted); margin-bottom: 2rem; }

  .token-info {
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 1rem;
    margin-bottom: 2rem;
    text-align: left;
  }

  .token-info .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
  }

  .token-info .info-row span:first-child { color: var(--text-muted); }
  .token-info .token-name { font-weight: 600; color: var(--accent); }
  .token-info a { color: var(--accent); }

  .success-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* How It Works */
  .how-it-works {
    margin-top: 3rem;
    text-align: center;
  }

  .how-it-works h3 {
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
  }

  .steps-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  .step-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    text-align: center;
  }

  .step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--gradient-1);
    border-radius: 50%;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .step-card h4 { margin-bottom: 0.5rem; font-size: 0.9rem; }
  .step-card p { font-size: 0.75rem; color: var(--text-muted); margin: 0; }

  /* Spinners */
  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .spinner.large {
    width: 48px;
    height: 48px;
    border-width: 3px;
    border-top-color: var(--accent);
  }

  .spinner-small {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .form-row { grid-template-columns: 1fr; }
    .steps-grid { grid-template-columns: 1fr; }
    .confirm-actions { flex-direction: column; }
  }
</style>
