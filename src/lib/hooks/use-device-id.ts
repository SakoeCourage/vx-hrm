import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

const DEVICE_ID_KEY = 'vx_hrm_device_id';

/**
 * Returns a stable UUID stored in SecureStore, generated once on first launch.
 * Used as the `deviceId` for attendance log API calls.
 */
export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        if (!id) {
          id = generateUUID();
          await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
        }
        if (!cancelled) setDeviceId(id);
      } catch {
        if (!cancelled) setDeviceId(generateUUID());
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  return deviceId;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
