import { useState, useCallback, useEffect } from 'react';

/**
 * Manages friend-comparison state and data fetching.
 *
 * Returns stable setters so callers can trigger navigation after compare()
 * resolves, keeping URL/tab logic in App.jsx.
 */
export default function useComparisonMode({ countryId, loadFriendVisited }) {
  // { id, name, picture, visited (Set), visitedRegions (array) }
  const [comparisonFriend, setComparisonFriend] = useState(null);
  const [comparisonData, setComparisonData] = useState(null); // raw API data
  const [showComparisonStats, setShowComparisonStats] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Re-slice region list whenever the active country changes
  useEffect(() => {
    if (!comparisonData) return;
    const countryRegions = (comparisonData.regions || [])
      .filter((r) => r.country_id === countryId)
      .flatMap((r) => r.regions || []);
    setComparisonFriend((prev) => (prev ? { ...prev, visitedRegions: countryRegions } : null));
  }, [countryId, comparisonData]);

  /**
   * Start or exit comparison.
   * Pass null/undefined to exit.
   * Returns true if data loaded successfully, false otherwise.
   */
  const compare = useCallback(async (friend) => {
    if (!friend) {
      setComparisonFriend(null);
      setComparisonData(null);
      setShowComparisonStats(false);
      return false;
    }

    setComparisonLoading(true);
    try {
      const data = await loadFriendVisited(friend.id);
      if (!data) return false;

      setComparisonData(data);
      const friendWorldCountries = new Set(data.world?.countries || []);
      const countryRegions = (data.regions || [])
        .filter((r) => r.country_id === countryId)
        .flatMap((r) => r.regions || []);
      setComparisonFriend({
        id: friend.id,
        name: friend.name,
        picture: friend.picture,
        visited: friendWorldCountries,
        visitedRegions: countryRegions,
      });
      return true;
    } catch (err) {
      console.error('Failed to load comparison data:', err);
      return false;
    } finally {
      setComparisonLoading(false);
    }
  }, [loadFriendVisited, countryId]);

  const exitComparison = useCallback(() => {
    setComparisonFriend(null);
    setComparisonData(null);
    setShowComparisonStats(false);
  }, []);

  return {
    comparisonFriend,
    comparisonData,
    showComparisonStats,
    setShowComparisonStats,
    comparisonLoading,
    compare,
    exitComparison,
  };
}
