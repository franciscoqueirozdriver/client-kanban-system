'use client';
import { useState, useEffect, useCallback } from 'react';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

async function fetchMessagesFromApi(app) {
  try {
    const res = await fetch(`/api/mensagens?app=${app}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.mensagens)) return data.mensagens;
    if (Array.isArray(data?.messages)) return data.messages;
    return [];
  } catch {
    return [];
  }
}

export default function useMessageCache(apps = ['whatsapp', 'email', 'linkedin']) {
  const [cache, setCache] = useState({});

  useEffect(() => {
    apps.forEach(async (app) => {
      const messages = await fetchMessagesFromApi(app);
      setCache((prev) => ({ ...prev, [app]: { messages, fetchedAt: Date.now() } }));
    });
  }, [apps]);

  const getMessages = useCallback(async (app) => {
    const cached = cache[app];
    if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) {
      return cached.messages;
    }
    const messages = await fetchMessagesFromApi(app);
    setCache((prev) => ({ ...prev, [app]: { messages, fetchedAt: Date.now() } }));
    return messages;
  }, [cache]);

  return getMessages;
}
