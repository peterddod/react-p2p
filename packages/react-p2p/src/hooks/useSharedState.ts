// src/hooks/useSharedState.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { SyncManager } from '../core/SyncManager';
import { useRoom } from './useRoom';

export function useSharedState<TState extends object = object>(
  stateKey: string,
  initialState: TState
): [TState, (next: TState | ((prev: TState) => TState)) => void] {
  const { broadcast, onMessage, peers, peerId } = useRoom();
  
  // UI state - triggers re-renders
  const [liveState, setLiveState] = useState<TState>(initialState);
  
  // Sync manager - handles all sync protocol logic
  const syncManagerRef = useRef<SyncManager<TState> | null>(null);
  const stateKeyRef = useRef(stateKey);
  const peerIdRef = useRef(peerId);
  
  // Update peerIdRef when peerId changes
  peerIdRef.current = peerId;
  
  // Initialize sync manager once
  if (!syncManagerRef.current) {
    syncManagerRef.current = new SyncManager(
      initialState,
      // onCommit callback - update React state when sync completes
      (committedState) => {
        setLiveState(committedState);
      },
      // broadcast callback - send messages with stateKey
      (message) => {
        broadcast({
          ...message,
          stateKey: stateKeyRef.current,
          peerId: peerIdRef.current,
        });
      }
    );
  }
  
  // Listen for sync messages
  useEffect(() => {
    const unsubscribe = onMessage((_peerId: string, message: any) => {
      // Filter messages for this stateKey
      if (message.stateKey !== stateKey) return;
      
      // Pass to sync manager - filter out self from peers
      const otherPeers = peers.filter(p => p !== peerId);
      syncManagerRef.current?.handleMessage(message, new Set(otherPeers));
    });
    
    return unsubscribe;
  }, [onMessage, peers, stateKey, peerId]);
  
  // setState function
  const setState = useCallback((next: TState | ((prev: TState) => TState)) => {
    // Update local state immediately (optimistic)
    setLiveState(prev => {
      const newState = typeof next === 'function' 
        ? (next as (prev: TState) => TState)(prev) 
        : next;
      
      // Notify sync manager (triggers background sync)
      // Filter out self from peers - we only expect diffs from OTHER peers
      const otherPeers = peers.filter(p => p !== peerId);
      syncManagerRef.current?.updateLocal(newState, new Set(otherPeers));
      
      return newState;
    });
  }, [peers, peerId]);
  
  return [liveState, setState];
}