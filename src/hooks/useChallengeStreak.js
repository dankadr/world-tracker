import { useMemo } from 'react';

/**
 * Calculate challenge streak data
 * @param {Object} challenge - Challenge object with created_at
 * @param {Array} participants - Array of participant objects with visited_regions
 * @param {number} userId - Current user's ID
 * @returns {Object} Streak information
 */
export default function useChallengeStreak(challenge, participants, userId) {
  return useMemo(() => {
    if (!challenge || !participants) {
      return {
        daysSinceStart: 0,
        daysActive: 0,
        currentStreak: 0,
        lastActivityDate: null,
      };
    }

    const now = new Date();
    const startDate = new Date(challenge.created_at);
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

    // Find current user's participation data
    const myParticipation = participants.find(p => p.user_id === userId);
    if (!myParticipation) {
      return {
        daysSinceStart,
        daysActive: 0,
        currentStreak: 0,
        lastActivityDate: null,
      };
    }

    // For now, we'll estimate activity based on visited count
    // In a full implementation, you'd track visit dates per challenge
    const visitedCount = myParticipation.visited_count || 0;
    
    // Simple heuristic: assume each visit was on a different day
    // This is a simplification - real implementation would need visit timestamps
    const daysActive = Math.min(visitedCount, daysSinceStart);
    
    // Calculate streak (simplified - would need actual visit dates)
    // For now, if they've visited recently, assume active streak
    const hasRecentActivity = visitedCount > 0;
    const currentStreak = hasRecentActivity ? Math.min(daysActive, 7) : 0;

    return {
      daysSinceStart,
      daysActive,
      currentStreak,
      lastActivityDate: hasRecentActivity ? now : null,
    };
  }, [challenge, participants, userId]);
}
