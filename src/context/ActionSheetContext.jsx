import { createContext, useContext, useState, useCallback } from 'react';
import ActionSheet from '../components/ActionSheet';

const ActionSheetContext = createContext(null);

export function ActionSheetProvider({ children }) {
  const [sheet, setSheet] = useState(null);

  const showActionSheet = useCallback(({ title, message, actions } = {}) => {
    setSheet({ title, message, actions: actions || [] });
  }, []);

  const handleCancel = useCallback(() => {
    setSheet(null);
  }, []);

  return (
    <ActionSheetContext.Provider value={{ showActionSheet }}>
      {children}
      <ActionSheet
        isOpen={!!sheet}
        title={sheet?.title}
        message={sheet?.message}
        actions={sheet?.actions || []}
        onCancel={handleCancel}
      />
    </ActionSheetContext.Provider>
  );
}

export function useActionSheet() {
  const ctx = useContext(ActionSheetContext);
  if (!ctx) {
    throw new Error('useActionSheet must be used within an ActionSheetProvider');
  }
  return ctx;
}
