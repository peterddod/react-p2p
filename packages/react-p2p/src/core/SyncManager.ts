// src/lib/SyncManager.ts
import { diff, patch, hash } from '../utils';

type PeerId = string;

export interface SyncMessage {
  type: 'SYNC_START' | 'DIFF' | 'HASH' | 'HASH_MISMATCH';
  stateKey: string;
  index: number;
  peerId: PeerId;
  diff?: any;
  diffHash?: string;
  nextHash?: string;
  diffsHash?: string;
}

interface PeerDiff {
  peerId: PeerId;
  diff: any;
  diffHash: string;
}

export class SyncManager<TState extends object = object> {
  // State indices
  private stateIndex = 0;
  
  // Three-state model
  private current: TState;
  private candidate: TState | null = null;
  private local: TState;
  
  // Sync coordination
  private syncInProgress = false;
  private pendingLocalChanges = false;
  private collectedDiffs = new Map<PeerId, PeerDiff>();
  private expectedPeers = new Set<PeerId>();
  
  // Callbacks
  private onCommit: (state: TState) => void;
  private broadcast: (message: any) => void;
  
  constructor(
    initialState: TState,
    onCommit: (state: TState) => void,
    broadcast: (message: any) => void
  ) {
    this.current = initialState;
    this.local = initialState;
    this.onCommit = onCommit;
    this.broadcast = broadcast;
  }
  
  // ============================================
  // PUBLIC API
  // ============================================
  
  /**
   * Update local state (optimistic update)
   */
  updateLocal(newState: TState, peers?: Set<PeerId>) {
    this.local = newState;
    this.pendingLocalChanges = true;
    
    // Store peers for sync initiation
    if (peers) {
      this.expectedPeers = peers;
    }
    
    // Trigger sync if not already in progress
    if (!this.syncInProgress) {
      this.startSync();
    }
  }
  
  /**
   * Handle incoming sync messages
   */
  handleMessage(message: SyncMessage, peers: Set<PeerId>) {
    switch (message.type) {
      case 'SYNC_START':
        this.handleSyncStart(message, peers);
        break;
        
      case 'DIFF':
        this.handleDiff(message);
        break;
        
      case 'HASH':
        this.handleHash(message);
        break;
    }
  }
  
  /**
   * Get current synced state
   */
  getCurrent(): TState {
    return this.current;
  }
  
  /**
   * Get current state index
   */
  getIndex(): number {
    return this.stateIndex;
  }
  
  // ============================================
  // SYNC PROTOCOL IMPLEMENTATION
  // ============================================
  
  private startSync() {
    if (this.syncInProgress) return;
    
    this.syncInProgress = true;
    
    // Step 2: Increment index and create candidate
    const nextIndex = this.stateIndex + 1;
    this.candidate = structuredClone(this.current);
    
    // Step 3: Broadcast SYNC_START
    this.broadcast({
      type: 'SYNC_START',
      index: nextIndex,
    });
    
    // Immediately send our diff (we initiated, so we're ready)
    this.sendDiff(nextIndex);
  }
  
  private handleSyncStart(message: SyncMessage, peers: Set<PeerId>) {
    // Another peer initiated sync
    const { index } = message;
    
    // If we're already syncing at this index, ignore
    if (this.syncInProgress && this.stateIndex + 1 === index) {
      return;
    }
    
    // Join the sync
    this.syncInProgress = true;
    this.stateIndex = index - 1; // Will increment to index
    this.candidate = structuredClone(this.current);
    this.expectedPeers = new Set(peers);
    this.collectedDiffs.clear();
    
    // Step 4: Send our diff
    this.sendDiff(index);
  }
  
  private sendDiff(index: number) {
    // Calculate diff from current to local
    const myDiff = diff<TState>(this.current, this.local);
    const diffHash = hash(myDiff);
    
    console.log('[SyncManager] Sending DIFF:', {
      index,
      current: this.current,
      local: this.local,
      diff: myDiff,
    });
    
    // Store our own diff immediately - we already know what it is!
    // Note: we can't use peerId here as SyncManager doesn't know it,
    // so we'll mark it with a special key
    this.collectedDiffs.set('__self__', {
      peerId: '__self__',
      diff: myDiff,
      diffHash,
    });
    
    console.log('[SyncManager] Added own diff. Collected:', this.collectedDiffs.size, 'Expected:', this.expectedPeers.size);
    
    this.broadcast({
      type: 'DIFF',
      index,
      diff: myDiff,
      diffHash,
    });
    
    // Check if we already have all diffs (in case of single peer or fast responses)
    if (this.collectedDiffs.size === this.expectedPeers.size + 1) { // +1 for our own
      console.log('[SyncManager] All diffs collected (including own), starting merge');
      this.mergePhase();
    }
  }
  
  private handleDiff(message: SyncMessage) {
    const { peerId, diff, diffHash, index } = message;
    
    console.log('[SyncManager] Received DIFF:', { peerId, index, diff, currentIndex: this.stateIndex });
    
    // Only collect diffs for current sync round
    if (index !== this.stateIndex + 1) {
      console.log('[SyncManager] Ignoring DIFF - index mismatch');
      return;
    }
    
    // Store diff from other peer
    this.collectedDiffs.set(peerId, {
      peerId,
      diff: diff || {},
      diffHash: diffHash || '',
    });
    
    console.log('[SyncManager] Collected diffs so far:', this.collectedDiffs.size, 'Expected:', this.expectedPeers.size + 1); // +1 for own
    console.log('[SyncManager] Expected peers:', Array.from(this.expectedPeers));
    
    // Check if we have all diffs (+1 for our own which was added in sendDiff)
    if (this.collectedDiffs.size === this.expectedPeers.size + 1) {
      console.log('[SyncManager] All diffs collected, starting merge');
      this.mergePhase();
    } else {
      console.log('[SyncManager] Still waiting for more diffs');
    }
  }
  
  private mergePhase() {
    if (!this.candidate) return;
    
    console.log('[SyncManager] Starting merge phase. Candidate:', this.candidate);
    console.log('[SyncManager] Collected diffs:', Array.from(this.collectedDiffs.values()));
    
    // Step 5: Apply all diffs in deterministic order
    const sortedDiffs = Array.from(this.collectedDiffs.values())
      .sort((a, b) => a.peerId.localeCompare(b.peerId));
    
    let merged = this.candidate;
    for (const { diff: diffData, peerId } of sortedDiffs) {
      // Only apply non-empty diffs
      if (diffData && typeof diffData === 'object' && Object.keys(diffData).length > 0) {
        console.log('[SyncManager] Applying diff from', peerId, ':', diffData);
        merged = patch(merged, diffData) as TState;
        console.log('[SyncManager] After applying diff, state:', merged);
      } else {
        console.log('[SyncManager] Skipping empty diff from', peerId);
      }
    }
    
    this.candidate = merged;
    console.log('[SyncManager] Final merged candidate:', this.candidate);
    
    // Step 6: Hash verification
    const nextHash = hash(this.candidate);
    const diffsHash = hash(
      sortedDiffs.map(d => ({ peerId: d.peerId, diffHash: d.diffHash }))
    );
    
    this.broadcast({
      type: 'HASH',
      index: this.stateIndex + 1,
      nextHash,
      diffsHash,
    });
    
    // For MVP, we'll assume hashes match and commit immediately
    // In production, you'd wait for all peers' hashes
    this.commitPhase();
  }
  
  private handleHash(message: SyncMessage) {
    // MVP: Skip hash validation
    // Production: collect hashes, validate, reconcile if needed
  }
  
  private commitPhase() {
    if (!this.candidate) return;
    
    console.log('[SyncManager] Committing state:', this.candidate);
    
    // Step 8: Commit the merged state
    this.stateIndex++;
    this.current = this.candidate;
    this.local = this.candidate; // Local now matches committed state
    this.candidate = null;
    
    // Notify React to re-render with committed state
    this.onCommit(this.current);
    
    // Step 9: Reset sync state and check for new changes
    const hadPendingChanges = this.pendingLocalChanges;
    this.pendingLocalChanges = false;
    this.syncInProgress = false;
    this.collectedDiffs.clear();
    
    if (hadPendingChanges) {
      // New changes came in during sync - start another round
      console.log('[SyncManager] Had pending changes, starting new sync');
      queueMicrotask(() => this.startSync());
    }
  }
}