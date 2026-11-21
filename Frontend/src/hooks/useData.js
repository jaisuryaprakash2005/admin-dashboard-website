import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../services/api.js';

// Loads data once, exposes loading / error / reload.
export default function useData(fetcher) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await fetcher()); }
    catch (e) { setError(errorMessage(e)); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);
  return { data, setData, loading, error, reload: load };
}
