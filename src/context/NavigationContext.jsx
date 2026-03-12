import { createContext, useContext, useState, useCallback } from 'react';

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [activeTab, setActiveTab] = useState('map');
  // Per-tab screen stacks: each entry is { screen: string, props: object }
  const [stacks, setStacks] = useState({
    map: [],
    explore: [],
    social: [],
    profile: [],
    admin: [],
  });

  const push = useCallback((screen, props = {}) => {
    setStacks(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], { screen, props }],
    }));
  }, [activeTab]);

  const pop = useCallback(() => {
    setStacks(prev => {
      const tabStack = prev[activeTab];
      if (tabStack.length === 0) return prev;
      return { ...prev, [activeTab]: tabStack.slice(0, -1) };
    });
  }, [activeTab]);

  const popToRoot = useCallback(() => {
    setStacks(prev => ({ ...prev, [activeTab]: [] }));
  }, [activeTab]);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  const currentStack = stacks[activeTab];
  const currentScreen = currentStack.length > 0 ? currentStack[currentStack.length - 1] : null;
  const canGoBack = currentStack.length > 0;

  return (
    <NavigationContext.Provider value={{
      activeTab,
      switchTab,
      push,
      pop,
      popToRoot,
      currentScreen,
      canGoBack,
      stacks,
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}

export default NavigationContext;
