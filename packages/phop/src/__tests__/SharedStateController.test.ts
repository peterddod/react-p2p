import { describe, expect, it, vi } from 'vitest';
import { createLamportStrategy, type LamportMeta } from '../core/merge-strategies/lamport';
import type { MergeStrategy } from '../core/merge-strategies/types';
import { type RoomHandle, SharedStateController } from '../core/SharedStateController';
import type { JSONSerializable } from '../types';

// ---------------------------------------------------------------------------
// Mock room
// ---------------------------------------------------------------------------

type MessageCallback = (msg: {
  senderId: string;
  data: JSONSerializable;
  timestamp: number;
}) => void;

function createMockRoom(
  peerId = 'peer-1',
  peers: string[] = ['peer-1']
): {
  room: RoomHandle;
  simulateMessage: (senderId: string, data: JSONSerializable) => void;
  simulatePeerConnected: (remotePeerId: string) => void;
} {
  const messageHandlers = new Set<MessageCallback>();
  const peerConnectedHandlers = new Set<(remotePeerId: string) => void>();

  const room: RoomHandle = {
    peerId,
    peers,
    broadcast: vi.fn(),
    sendToPeer: vi.fn(),
    onMessage: (handler) => {
      const cb = handler as MessageCallback;
      messageHandlers.add(cb);
      return () => {
        messageHandlers.delete(cb);
      };
    },
    onPeerConnected: (handler) => {
      peerConnectedHandlers.add(handler);
      return () => {
        peerConnectedHandlers.delete(handler);
      };
    },
  };

  return {
    room,
    simulateMessage: (senderId, data) => {
      for (const h of messageHandlers) {
        h({ senderId, data, timestamp: Date.now() });
      }
    },
    simulatePeerConnected: (remotePeerId) => {
      for (const h of peerConnectedHandlers) {
        h(remotePeerId);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestController(
  key = 'test-key',
  initialState: JSONSerializable | null = null,
  peerId = 'peer-1'
) {
  const mock = createMockRoom(peerId);
  const strategy = createLamportStrategy(() => mock.room.peerId);
  const controller = new SharedStateController(key, initialState, strategy, mock.room);
  return { controller, ...mock, strategy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SharedStateController', () => {
  it('returns initial state from getState()', () => {
    const { controller } = createTestController('k', 42);
    expect(controller.getState()).toBe(42);
  });

  it('notifies subscribers when local setState triggers a commit via strategy', () => {
    const { controller } = createTestController('k', 0);
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.setState(1);

    expect(listener).toHaveBeenCalled();
    expect(controller.getState()).toBe(1);
  });

  it('subscribe returns an unsubscribe function', () => {
    const { controller } = createTestController('k', 0);
    const listener = vi.fn();
    const unsub = controller.subscribe(listener);

    controller.setState(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    controller.setState(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('getState() is referentially stable when state has not changed', () => {
    const { controller } = createTestController('k', 'hello');
    const a = controller.getState();
    const b = controller.getState();
    expect(a).toBe(b);
  });

  it('responds to state-request messages with current state', () => {
    const { room, simulateMessage } = createTestController('k', 99, 'peer-1');

    simulateMessage('peer-2', { type: 'state-request', key: 'k' });

    expect(room.sendToPeer).toHaveBeenCalledWith(
      'peer-2',
      expect.objectContaining({
        senderId: 'peer-1',
        data: expect.objectContaining({ key: 'k', state: 99 }),
      })
    );
  });

  it('ignores state-request messages for other keys', () => {
    const { room, simulateMessage } = createTestController('k', 99);

    simulateMessage('peer-2', { type: 'state-request', key: 'other-key' });

    expect(room.sendToPeer).not.toHaveBeenCalled();
  });

  it('ignores messages from self', () => {
    const { controller, simulateMessage } = createTestController('k', 0, 'peer-1');
    const listener = vi.fn();
    controller.subscribe(listener);

    simulateMessage('peer-1', { key: 'k', state: 99, meta: { clock: 5, tiebreaker: 'peer-1' } });

    expect(listener).not.toHaveBeenCalled();
    expect(controller.getState()).toBe(0);
  });

  it('filters messages by key', () => {
    const { controller, simulateMessage } = createTestController('k', 0, 'peer-1');
    const listener = vi.fn();
    controller.subscribe(listener);

    simulateMessage('peer-2', {
      key: 'wrong',
      state: 99,
      meta: { clock: 5, tiebreaker: 'peer-2' },
    });

    expect(listener).not.toHaveBeenCalled();
    expect(controller.getState()).toBe(0);
  });

  it('accepts incoming state when remote clock wins', () => {
    const { controller, simulateMessage } = createTestController('k', 0, 'peer-1');

    // Remote peer has a higher Lamport clock.
    simulateMessage('peer-2', { key: 'k', state: 42, meta: { clock: 10, tiebreaker: 'peer-2' } });

    expect(controller.getState()).toBe(42);
  });

  it('strips key from SharedStatePayload before forwarding to strategy', () => {
    // Verify the strategy receives { state, meta } (without key).
    // We do this indirectly by checking that a remote update with a
    // higher clock is accepted (the Lamport strategy relies on the
    // stripped shape).
    const { controller, simulateMessage } = createTestController('k', 0, 'peer-1');

    simulateMessage('peer-2', {
      key: 'k',
      state: 'updated',
      meta: { clock: 100, tiebreaker: 'peer-2' },
    });

    expect(controller.getState()).toBe('updated');
  });

  it('passes non-SharedStatePayload keyed messages intact to strategy', () => {
    // Consensus-style messages have { key, type: 'propose', ... } but no
    // state/meta. The controller should forward these intact.
    let receivedData: JSONSerializable | null = null;

    const customStrategy: MergeStrategy<JSONSerializable, LamportMeta> = {
      initialMeta: { clock: 0, tiebreaker: '' },
      connect(ctx) {
        const unsub = ctx.onMessage((data) => {
          receivedData = data;
        });
        const unsubWrite = ctx.onLocalWrite(() => {});
        return () => {
          unsub();
          unsubWrite();
        };
      },
    };

    const mock = createMockRoom('peer-1');
    const controller = new SharedStateController('k', null, customStrategy, mock.room);

    mock.simulateMessage('peer-2', { key: 'k', type: 'propose', round: 1 });

    expect(receivedData).toEqual({ key: 'k', type: 'propose', round: 1 });
    controller.destroy();
  });

  it('fires onPeersChanged handlers when syncRoom receives new peers', () => {
    const mock = createMockRoom('peer-1', ['peer-1']);
    const strategy = createLamportStrategy(() => 'peer-1');
    const controller = new SharedStateController('k', 0, strategy, mock.room);

    controller.destroy();

    const peerChangeSpy = vi.fn<(peers: string[]) => void>();
    const customStrategy: MergeStrategy<JSONSerializable, LamportMeta> = {
      initialMeta: { clock: 0, tiebreaker: '' },
      connect(ctx) {
        const unsub = ctx.onPeersChanged(peerChangeSpy);
        const unsubWrite = ctx.onLocalWrite(() => {});
        return () => {
          unsub();
          unsubWrite();
        };
      },
    };

    const mock2 = createMockRoom('peer-1', ['peer-1']);
    const ctrl = new SharedStateController('k', 0, customStrategy, mock2.room);

    const newPeers = ['peer-1', 'peer-2'];
    ctrl.syncRoom({ ...mock2.room, peers: newPeers });

    expect(peerChangeSpy).toHaveBeenCalledWith(newPeers);
    ctrl.destroy();
  });

  it('broadcasts local state on peer connected', () => {
    const { room, simulatePeerConnected } = createTestController('k', 'hello', 'peer-1');

    simulatePeerConnected('peer-2');

    expect(room.sendToPeer).toHaveBeenCalledWith(
      'peer-2',
      expect.objectContaining({
        data: expect.objectContaining({ state: 'hello', key: 'k' }),
      })
    );
  });

  it('cleans up on destroy', () => {
    const { controller } = createTestController('k', 0);
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.destroy();
    controller.setState(1);

    expect(listener).not.toHaveBeenCalled();
  });
});
