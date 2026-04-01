import { useState, useEffect, useCallback } from 'react';

export default function useComparisonMode({ countryId, loadFriendVisited }) {
  const [comparisonFriend, setComparisonFriend] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [showComparisonStats, setShowComparisonStats] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const exitComparison = useCallback(() => {
    setComparisonFriend(null);
    setComparisonData(null);
    setShowComparisonStats(false);
    setComparisonLoading(false);
  }, []);

  const closeComparisonStats = useCallback(() => {
    setShowComparisonStats(false);
  }, []);

  const openComparisonStats = useCallback(() => {
    setShowComparisonStats(true);
  }, []);

  const doCompare = useCallback(async (friend) => {
    if (!friend) {
      exitComparison();
      return false;
    }

    setComparisonLoading(true);
    setShowComparisonStats(false);

    try {
      const data = await loadFriendVisited(friend.id);
      if (!data) return false;

      const friendWorldCountries = new Set(data.world?.countries || []);
      const countryRegions = (data.regions || [])
        .filter((region) => region.country_id === countryId)
        .flatMap((region) => region.regions || []);

      setComparisonData(data);
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
  }, [countryId, exitComparison, loadFriendVisited]);

  useEffect(() => {
    if (!comparisonData) return;

    const countryRegions = (comparisonData.regions || [])
      .filter((region) => region.country_id === countryId)
      .flatMap((region) => region.regions || []);

    setComparisonFriend((prev) => (
      prev ? { ...prev, visitedRegions: countryRegions } : null
    ));
  }, [countryId, comparisonData]);

  return {
    comparisonFriend,
    comparisonLoading,
    showComparisonStats,
    openComparisonStats,
    closeComparisonStats,
    doCompare,
    exitComparison,
  };
}
