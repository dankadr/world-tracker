import Screen from './Screen';
import YearInReview from './YearInReview';

export default function YearInReviewScreen({ year, onBack }) {
  return (
    <Screen title={`${year} in Review`} onBack={onBack} backLabel="Stats">
      <YearInReview year={year} onClose={onBack} embedded hideClose />
    </Screen>
  );
}
