import { useContext } from 'react';
import { RoomContext, type RoomContextValue } from '../context/Room';

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a Room provider');
  }
  return context;
}
