import { useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext';
import Screen from './Screen';
import StatsModal from './StatsModal';

export default function StatsScreen({ onBack }) {
  const { push } = useNavigation();
  const handleOpenYearInReview = useCallback((year) => {
    push('yearInReview', { year });
  }, [push]);

  return (
    <Screen title="Travel Stats" onBack={onBack}>
      <StatsModal embedded onOpenYearInReview={handleOpenYearInReview} />
    </Screen>
  );
}
