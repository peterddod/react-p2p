import { act, renderHook } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RoomContext, type RoomContextValue } from '../context/Room';
import { useSharedState } from '../hooks/useSharedState';

function createMockRoomContext(peerId = 'peer-1', peers: string[] = ['peer-1']): {
  value: RoomContextValue;
  wrapper: React.FC<PropsWithChildren>;
} {
  const value: RoomContextValue = {
    roomId: 'test-room',
    peerId,
    peers,
    isConnected: true,
    broadcast: vi.fn(),
    sendToPeer: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onPeerConnected: vi.fn(() => () => {}),
  };

  const wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
  );

  return { value, wrapper };
}

function createStrictMockRoomContext(peerId = 'peer-1', peers: string[] = ['peer-1']): {
  value: RoomContextValue;
  wrapper: React.FC<PropsWithChildren>;
} {
  const { value, wrapper: BaseWrapper } = createMockRoomContext(peerId, peers);
  const wrapper: React.FC<PropsWithChildren> = ({ children }) => (
    <StrictMode>
      <BaseWrapper>{children}</BaseWrapper>
    </StrictMode>
  );
  return { value, wrapper };
}

describe('useSharedState', () => {
  it('supports functional updater form like useState', () => {
    const { value, wrapper } = createMockRoomContext();
    const { result } = renderHook(() => useSharedState<number>('counter', 0), { wrapper });

    act(() => {
      result.current[1]((prev) => (prev ?? 0) + 1);
    });

    expect(result.current[0]).toBe(1);
    const broadcastCall = (value.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(broadcastCall.data.state).toBe(1);
    expect(typeof broadcastCall.data.state).toBe('number');
  });

  it('works under StrictMode without duplicating local broadcasts', () => {
    const { value, wrapper } = createStrictMockRoomContext();

    const { result } = renderHook(() => useSharedState<number>('counter', 0), { wrapper });

    act(() => {
      result.current[1](1);
    });

    expect(value.broadcast).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toBe(1);
  });

  it('uses latest peerId in Lamport metadata after initial empty peerId', () => {
    const state = {
      current: {
        roomId: 'test-room',
        peerId: '',
        peers: ['peer-1'],
        isConnected: true,
        broadcast: vi.fn(),
        sendToPeer: vi.fn(),
        onMessage: vi.fn(() => () => {}),
        onPeerConnected: vi.fn(() => () => {}),
      } as RoomContextValue,
    };

    const wrapper: React.FC<PropsWithChildren> = ({ children }) => (
      <RoomContext.Provider value={state.current}>{children}</RoomContext.Provider>
    );

    const { result, rerender } = renderHook(() => useSharedState<number>('counter', 0), { wrapper });

    state.current = { ...state.current, peerId: 'peer-1' };
    rerender();

    act(() => {
      result.current[1](1);
    });

    const broadcastCall = (state.current.broadcast as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(broadcastCall.data.meta).toEqual(expect.objectContaining({ tiebreaker: 'peer-1' }));
  });
});
