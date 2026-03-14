import { useNavigation } from '../context/NavigationContext';
import ChallengeScreen from './ChallengeScreen';
import GamesScreen from './GamesScreen';
import StatsScreen from './StatsScreen';
import YearInReviewScreen from './YearInReviewScreen';
import BucketListScreen from './BucketListScreen';
import ComparisonStatsScreen from './ComparisonStatsScreen';

const SCREEN_REGISTRY = {
  challenge: ChallengeScreen,
  games: GamesScreen,
  stats: StatsScreen,
  yearInReview: YearInReviewScreen,
  bucketList: BucketListScreen,
  comparisonStats: ComparisonStatsScreen,
};

/**
 * Renders pushed screens for the active tab.
 * Each entry in the stack is { screen: string, props: object }.
 * All screens stay mounted (only top is visible) to preserve component state.
 */
export default function NavigationStack() {
  const { stacks, activeTab, pop } = useNavigation();
  const stack = stacks[activeTab] ?? [];

  if (stack.length === 0) return null;

  return stack.map((entry, index) => {
    const Component = SCREEN_REGISTRY[entry.screen];
    if (!Component) return null;
    const isTop = index === stack.length - 1;
    return (
      <div
        key={`${index}-${entry.screen}`}
        style={isTop ? undefined : { display: 'none' }}
        aria-hidden={!isTop}
      >
        <Component {...entry.props} onBack={pop} />
      </div>
    );
  });
}
