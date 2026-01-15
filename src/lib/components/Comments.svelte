<script lang="ts">
  import { isAuthenticated, auth } from '$lib/stores';
  import { toasts } from '$lib/stores/toast';
  import { MessageSquare, Heart, Send, Loader2 } from 'lucide-svelte';

  interface Comment {
    id: string;
    userId: string;
    userAddress: string;
    username: string | null;
    content: string;
    createdAt: string;
    likes: number;
    isLiked?: boolean;
  }

  interface Props {
    tokenId: string;
    comments?: Comment[];
  }

  let { tokenId, comments: initialComments = [] }: Props = $props();

  let comments = $state<Comment[]>(initialComments);
  let newComment = $state('');
  let isSubmitting = $state(false);
  let sortBy = $state<'newest' | 'oldest' | 'popular'>('newest');

  // Mock comments for demo
  if (comments.length === 0) {
    comments = [
      {
        id: '1',
        userId: '1',
        userAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38',
        username: 'degen_trader',
        content: 'This is going to moon! 🚀🚀🚀 Dev is based and the community is amazing!',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        likes: 42,
        isLiked: false,
      },
      {
        id: '2',
        userId: '2',
        userAddress: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        username: null,
        content: 'Just aped in with 2 MATIC. LFG!!! 💎🙌',
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        likes: 18,
        isLiked: true,
      },
      {
        id: '3',
        userId: '3',
        userAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        username: 'crypto_whale',
        content: 'Chart looking bullish. Higher lows forming. Next resistance at 0.0002.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        likes: 31,
        isLiked: false,
      },
      {
        id: '4',
        userId: '4',
        userAddress: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        username: 'pump_master',
        content: 'Bonding curve looks healthy. Good buy pressure.',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        likes: 8,
        isLiked: false,
      },
    ];
  }

  function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  function shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function getSortedComments(): Comment[] {
    return [...comments].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        return b.likes - a.likes;
      }
    });
  }

  async function handleSubmit() {
    if (!$isAuthenticated) {
      toasts.warning('Please connect wallet to comment');
      return;
    }

    const content = newComment.trim();
    if (!content) {
      toasts.error('Comment cannot be empty');
      return;
    }

    if (content.length > 500) {
      toasts.error('Comment too long (max 500 characters)');
      return;
    }

    isSubmitting = true;
    
    try {
      // TODO: API call to post comment
      // const result = await api.comments.create({ tokenId, content });
      
      // Mock response
      await new Promise(r => setTimeout(r, 500));
      
      const newCommentObj: Comment = {
        id: String(Date.now()),
        userId: $auth.user?.id || '',
        userAddress: $auth.user?.address || '',
        username: $auth.user?.username || null,
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
      };

      comments = [newCommentObj, ...comments];
      newComment = '';
      toasts.success('Comment posted!');
    } catch (err: any) {
      toasts.error(err.message || 'Failed to post comment');
    } finally {
      isSubmitting = false;
    }
  }

  async function handleLike(commentId: string) {
    if (!$isAuthenticated) {
      toasts.warning('Please connect wallet to like');
      return;
    }

    // Toggle like
    comments = comments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          likes: c.isLiked ? c.likes - 1 : c.likes + 1,
          isLiked: !c.isLiked,
        };
      }
      return c;
    });
  }
</script>

<div class="comments-section">
  <div class="comments-header">
    <h3><MessageSquare size={18} /> Thread ({comments.length})</h3>
    <div class="sort-options">
      <button 
        class="sort-btn" 
        class:active={sortBy === 'newest'}
        onclick={() => sortBy = 'newest'}
      >
        Newest
      </button>
      <button 
        class="sort-btn" 
        class:active={sortBy === 'popular'}
        onclick={() => sortBy = 'popular'}
      >
        Popular
      </button>
    </div>
  </div>

  <!-- Comment Input -->
  <div class="comment-input">
    <textarea 
      bind:value={newComment}
      placeholder={$isAuthenticated ? "What do you think about this token?" : "Connect wallet to comment"}
      disabled={!$isAuthenticated || isSubmitting}
      maxlength="500"
      rows="3"
    ></textarea>
    <div class="input-footer">
      <span class="char-count">{newComment.length}/500</span>
      <button 
        class="btn btn-primary btn-sm"
        onclick={handleSubmit}
        disabled={!$isAuthenticated || isSubmitting || !newComment.trim()}
      >
        {#if isSubmitting}
          <Loader2 size={14} class="spin" /> Posting...
        {:else}
          <Send size={14} /> Post
        {/if}
      </button>
    </div>
  </div>

  <!-- Comments List -->
  <div class="comments-list">
    {#each getSortedComments() as comment (comment.id)}
      <div class="comment">
        <div class="comment-avatar">
          {comment.username ? comment.username.slice(0, 2).toUpperCase() : comment.userAddress.slice(2, 4).toUpperCase()}
        </div>
        <div class="comment-body">
          <div class="comment-header">
            <span class="username">
              {comment.username || shortenAddress(comment.userAddress)}
            </span>
            <span class="timestamp">{formatTimeAgo(comment.createdAt)}</span>
          </div>
          <p class="comment-content">{comment.content}</p>
          <div class="comment-actions">
            <button 
              class="action-btn like-btn" 
              class:liked={comment.isLiked}
              onclick={() => handleLike(comment.id)}
            >
              <Heart size={14} fill={comment.isLiked ? 'currentColor' : 'none'} /> {comment.likes}
            </button>
            <button class="action-btn">Reply</button>
          </div>
        </div>
      </div>
    {:else}
      <div class="no-comments">
        <span class="icon"><MessageSquare size={32} /></span>
        <p>No comments yet. Be the first to share your thoughts!</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .comments-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .comments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
  }

  .comments-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .sort-options {
    display: flex;
    gap: 0.5rem;
  }

  .sort-btn {
    padding: 0.25rem 0.75rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .sort-btn:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  .sort-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .comment-input {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-tertiary);
  }

  .comment-input textarea {
    width: 100%;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 0.875rem;
    resize: none;
    transition: border-color 0.2s;
  }

  .comment-input textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .comment-input textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
  }

  .char-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .comments-list {
    max-height: 500px;
    overflow-y: auto;
  }

  .comment {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.2s;
  }

  .comment:hover {
    background: var(--bg-tertiary);
  }

  .comment:last-child {
    border-bottom: none;
  }

  .comment-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--gradient-1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .comment-body {
    flex: 1;
    min-width: 0;
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .username {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--accent);
  }

  .timestamp {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .comment-content {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    word-wrap: break-word;
  }

  .comment-actions {
    display: flex;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
  }

  .action-btn:hover {
    color: var(--text);
  }

  .like-btn.liked {
    color: #ef4444;
  }

  .no-comments {
    padding: 3rem;
    text-align: center;
    color: var(--text-muted);
  }

  .no-comments .icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
</style>
