import { useState, useCallback, useEffect } from 'react';

/**
 * Manages friend-comparison state and data fetching.
 *
 * Responsible for:
 *   - loading a friend's visited data from the API
 *   - updating the comparison regions when the active tracker changes
 *   - open/close state of the comparison stats panel
 *
 * Navigation side-effects (switchTab, push, setShowFriends) stay in App
 * because they depend on isMobile / isShareMode which live there.
 */
export default function useComparisonMode({ countryId, loadFriendVisited }) {
  const [comparisonFriend, setComparisonFriend] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [showComparisonStats, setShowComparisonStats] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Re-slice the friend's region list whenever the active tracker changes.
  useEffect(() => {
    if (!comparisonData) return;
    const countryRegions = (comparisonData.regions || [])
      .filter((r) => r.country_id === countryId)
      .flatMap((r) => r.regions || []);
    setComparisonFriend((prev) => (prev ? { ...prev, visitedRegions: countryRegions } : null));
  }, [countryId, comparisonData]);

  /**
   * Load a friend's data and enter comparison mode.
   * Pass null to exit comparison mode.
   * Returns true if data was loaded successfully, false otherwise.
   */
  const compare = useCallback(
    async (friend) => {
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
    },
    [loadFriendVisited, countryId],
  );

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
