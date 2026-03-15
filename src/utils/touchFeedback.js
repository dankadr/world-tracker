export const IOS_TOUCH_FEEDBACK_CLASS = 'ios-touch-feedback';

export function withTouchFeedback(className = '') {
  return [className, IOS_TOUCH_FEEDBACK_CLASS].filter(Boolean).join(' ');
}
