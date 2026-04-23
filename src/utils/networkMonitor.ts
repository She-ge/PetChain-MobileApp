import NetInfo, { type NetInfoState, type NetInfoStateType } from '@react-native-community/netinfo';

type NetworkCallback = (isOnline: boolean) => void;
type SyncCallback = () => Promise<void>;

class NetworkMonitor {
  private unsubscribe: (() => void) | null = null;
  private callbacks: NetworkCallback[] = [];
  private syncCallback: SyncCallback | null = null;
  private isCurrentlyOnline = false;

  startNetworkMonitoring(): void {
    this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isCurrentlyOnline;
      this.isCurrentlyOnline = state.isConnected ?? false;

      // Trigger sync when coming online
      if (!wasOnline && this.isCurrentlyOnline && this.syncCallback) {
        this.syncCallback().catch(console.error);
      }

      // Notify all callbacks
      this.callbacks.forEach((callback) => callback(this.isCurrentlyOnline));
    });
  }

  stopNetworkMonitoring(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.callbacks = [];
  }

  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  async getNetworkType(): Promise<NetInfoStateType> {
    const state = await NetInfo.fetch();
    return state.type;
  }

  onNetworkChange(callback: NetworkCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  setSyncCallback(callback: SyncCallback): void {
    this.syncCallback = callback;
  }

  async getNetworkQuality(): Promise<'wifi' | 'cellular' | 'unknown'> {
    const state = await NetInfo.fetch();
    if (state.type === 'wifi') return 'wifi';
    if (state.type === 'cellular') return 'cellular';
    return 'unknown';
  }
}

export const networkMonitor = new NetworkMonitor();

// Convenience exports
export const startNetworkMonitoring = () => networkMonitor.startNetworkMonitoring();
export const stopNetworkMonitoring = () => networkMonitor.stopNetworkMonitoring();
export const isOnline = () => networkMonitor.isOnline();
export const getNetworkType = () => networkMonitor.getNetworkType();
export const onNetworkChange = (callback: NetworkCallback) =>
  networkMonitor.onNetworkChange(callback);
export const setSyncCallback = (callback: SyncCallback) => networkMonitor.setSyncCallback(callback);
export const getNetworkQuality = () => networkMonitor.getNetworkQuality();
