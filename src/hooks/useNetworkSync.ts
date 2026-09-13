import { useState, useEffect, useCallback } from 'react';

export interface UseNetworkSyncOptions {
  isCloudActive: boolean;
  onSyncTrigger?: () => Promise<void> | void;
}

export interface NetworkSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  reconnectedNotice: boolean;
  forceSyncCheck: () => Promise<boolean>;
  setSyncingState: (syncing: boolean) => void;
  recordSyncSuccess: () => void;
  dismissReconnectedNotice: () => void;
}

export function useNetworkSync({
  isCloudActive,
  onSyncTrigger
}: UseNetworkSyncOptions): NetworkSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => new Date());
  const [reconnectedNotice, setReconnectedNotice] = useState<boolean>(false);

  // Network event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setReconnectedNotice(true);
      setLastSyncTime(new Date());

      // Try running sync callback if provided
      if (onSyncTrigger) {
        setIsSyncing(true);
        Promise.resolve(onSyncTrigger())
          .catch((err) => console.warn('Sync on reconnect notice:', err))
          .finally(() => {
            setTimeout(() => setIsSyncing(false), 800);
          });
      }

      // Auto-hide reconnected toast after 4.5 seconds
      const timer = setTimeout(() => {
        setReconnectedNotice(false);
      }, 4500);

      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setReconnectedNotice(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onSyncTrigger]);

  const recordSyncSuccess = useCallback(() => {
    setLastSyncTime(new Date());
  }, []);

  const setSyncingState = useCallback((syncing: boolean) => {
    setIsSyncing(syncing);
    if (!syncing) {
      setLastSyncTime(new Date());
    }
  }, []);

  const forceSyncCheck = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true);
    try {
      if (onSyncTrigger) {
        await onSyncTrigger();
      } else {
        // Fallback simulated short network ping delay
        await new Promise((r) => setTimeout(r, 700));
      }
      setLastSyncTime(new Date());
      return true;
    } catch (err) {
      console.warn('Manual sync check notice:', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncTrigger]);

  const dismissReconnectedNotice = useCallback(() => {
    setReconnectedNotice(false);
  }, []);

  return {
    isOnline,
    isSyncing,
    lastSyncTime,
    reconnectedNotice,
    forceSyncCheck,
    setSyncingState,
    recordSyncSuccess,
    dismissReconnectedNotice
  };
}
