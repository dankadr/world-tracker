import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { countryList } from '../data/countries';
import { secureStorage } from '../utils/secureStorage';
import {
  fetchWishlist,
  upsertWishlistItem,
  updateWishlistItem as updateWishlistItemApi,
  deleteWishlistItem as deleteWishlistItemApi,
} from '../utils/api';

// --------------- localStorage helpers ---------------
function storagePrefix(userId) {
  return userId ? `swiss-tracker-u${userId}-` : 'swiss-tracker-';
}

function loadLocalBucketList(userId) {
  try {
    const raw = secureStorage.getItemSync(storagePrefix(userId) + 'bucket-list');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  // Legacy migration: convert old wishlist arrays to bucket list items
  const legacyItems = [];
  const nowIso = new Date().toISOString();
  countryList.forEach((c) => {
    try {
      const raw = secureStorage.getItemSync(storagePrefix(userId) + 'wishlist-' + c.id);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((regionId) => {
          legacyItems.push({
            tracker_id: c.id,
            region_id: regionId,
            priority: 'medium',
            target_date: null,
            notes: null,
            category: 'solo',
            created_at: nowIso,
          });
        });
      }
    } catch { /* ignore */ }
  });

  if (legacyItems.length > 0) {
    saveLocalBucketList(legacyItems, userId);
    return legacyItems;
  }

  return [];
}

function saveLocalBucketList(items, userId) {
  secureStorage.setItem(storagePrefix(userId) + 'bucket-list', JSON.stringify(items));
}

// --------------- Hook ---------------
export default function useWishlist() {
  const { token, isLoggedIn, user } = useAuth();
  const userId = user?.id || null;
  const [items, setItems] = useState(() => loadLocalBucketList(userId));
  const [loading, setLoading] = useState(false);
  const prevLoggedIn = useRef(isLoggedIn);
  const prevUserId = useRef(userId);

  // Reload when user changes
  useEffect(() => {
    if (userId !== prevUserId.current) {
      prevUserId.current = userId;
      setItems(loadLocalBucketList(userId));
    }
  }, [userId]);

  // Sync from server when logged in
  useEffect(() => {
    if (!isLoggedIn || !token) return;
    let cancelled = false;
    setLoading(true);

    fetchWishlist(token)
      .then((serverItems) => {
        if (cancelled) return;
        const local = loadLocalBucketList(userId);
        if (!prevLoggedIn.current && local.length > 0 && serverItems.length === 0) {
          // First login: push local data to server
          local.forEach((item) => {
            upsertWishlistItem(token, item.tracker_id, item.region_id, {
              priority: item.priority || 'medium',
              target_date: item.target_date || null,
              notes: item.notes || null,
              category: item.category || 'solo',
            });
          });
        } else {
          setItems(serverItems);
          saveLocalBucketList(serverItems, userId);
        }
        prevLoggedIn.current = true;
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [isLoggedIn, token, userId]);

  // On logout, clear
  useEffect(() => {
    if (!isLoggedIn && prevLoggedIn.current) {
      prevLoggedIn.current = false;
      setItems([]);
    }
  }, [isLoggedIn]);

  const addToWishlist = useCallback(
    async (trackerId, regionId, opts = {}) => {
      const newItem = {
        tracker_id: trackerId,
        region_id: regionId,
        priority: opts.priority || 'medium',
        target_date: opts.target_date || null,
        notes: opts.notes || null,
        category: opts.category || 'solo',
        created_at: new Date().toISOString(),
      };

      setItems((prev) => {
        // Replace if exists, add otherwise
        const filtered = prev.filter(
          (i) => !(i.tracker_id === trackerId && i.region_id === regionId)
        );
        const next = [newItem, ...filtered];
        saveLocalBucketList(next, userId);
        return next;
      });

      if (isLoggedIn && token) {
        try {
          const saved = await upsertWishlistItem(token, trackerId, regionId, {
            priority: newItem.priority,
            target_date: newItem.target_date,
            notes: newItem.notes,
            category: newItem.category,
          });
          // Update with server data
          setItems((prev) => {
            const next = prev.map((i) =>
              i.tracker_id === trackerId && i.region_id === regionId ? saved : i
            );
            saveLocalBucketList(next, userId);
            return next;
          });
        } catch (err) {
          console.error('addToWishlist remote error:', err);
        }
      }
    },
    [userId, isLoggedIn, token]
  );

  const updateItem = useCallback(
    async (trackerId, regionId, updates) => {
      setItems((prev) => {
        const next = prev.map((i) =>
          i.tracker_id === trackerId && i.region_id === regionId
            ? { ...i, ...updates }
            : i
        );
        saveLocalBucketList(next, userId);
        return next;
      });

      if (isLoggedIn && token) {
        try {
          await updateWishlistItemApi(token, trackerId, regionId, updates);
        } catch (err) {
          console.error('updateItem remote error:', err);
        }
      }
    },
    [userId, isLoggedIn, token]
  );

  const removeFromWishlist = useCallback(
    async (trackerId, regionId) => {
      setItems((prev) => {
        const next = prev.filter(
          (i) => !(i.tracker_id === trackerId && i.region_id === regionId)
        );
        saveLocalBucketList(next, userId);
        return next;
      });

      if (isLoggedIn && token) {
        try {
          await deleteWishlistItemApi(token, trackerId, regionId);
        } catch (err) {
          console.error('removeFromWishlist remote error:', err);
        }
      }
    },
    [userId, isLoggedIn, token]
  );

  const isInWishlist = useCallback(
    (trackerId, regionId) => {
      return items.some(
        (i) => i.tracker_id === trackerId && i.region_id === regionId
      );
    },
    [items]
  );

  const getItem = useCallback(
    (trackerId, regionId) => {
      return items.find(
        (i) => i.tracker_id === trackerId && i.region_id === regionId
      ) || null;
    },
    [items]
  );

  const refreshFromServer = useCallback(async () => {
    if (!isLoggedIn || !token) return;
    setLoading(true);
    try {
      const serverItems = await fetchWishlist(token);
      setItems(serverItems);
      saveLocalBucketList(serverItems, userId);
    } catch { /* ignore */ }
    setLoading(false);
  }, [isLoggedIn, token, userId]);

  return {
    items,
    loading,
    addToWishlist,
    updateItem,
    removeFromWishlist,
    isInWishlist,
    getItem,
    refreshFromServer,
  };
}
