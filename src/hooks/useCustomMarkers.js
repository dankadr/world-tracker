import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

async function fetchWithAuth(url, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}

export default function useCustomMarkers() {
  const { token, isLoggedIn } = useAuth();
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setMarkers([]);
      return;
    }
    setLoading(true);
    fetchWithAuth('/api/markers', {}, token)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMarkers(Array.isArray(data) ? data : []))
      .catch(() => setMarkers([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn, token]);

  const addMarker = useCallback(async ({ lat, lng, label, icon, color }) => {
    if (!isLoggedIn || !token) return null;
    try {
      const res = await fetchWithAuth('/api/markers', {
        method: 'POST',
        body: JSON.stringify({ lat, lng, label: label || null, icon: icon || '📍', color: color || '#c9a84c' }),
      }, token);
      if (!res.ok) return null;
      const created = await res.json();
      setMarkers((prev) => [...prev, created]);
      return created;
    } catch {
      return null;
    }
  }, [isLoggedIn, token]);

  const updateMarker = useCallback(async (id, updates) => {
    if (!isLoggedIn || !token) return null;
    try {
      const res = await fetchWithAuth(`/api/markers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }, token);
      if (!res.ok) return null;
      const updated = await res.json();
      setMarkers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      return updated;
    } catch {
      return null;
    }
  }, [isLoggedIn, token]);

  const deleteMarker = useCallback(async (id) => {
    if (!isLoggedIn || !token) return false;
    try {
      const res = await fetchWithAuth(`/api/markers/${id}`, { method: 'DELETE' }, token);
      if (!res.ok) return false;
      setMarkers((prev) => prev.filter((m) => m.id !== id));
      return true;
    } catch {
      return false;
    }
  }, [isLoggedIn, token]);

  return { markers, loading, addMarker, updateMarker, deleteMarker };
}
