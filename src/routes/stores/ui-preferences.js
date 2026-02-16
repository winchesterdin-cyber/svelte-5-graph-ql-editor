const DEFAULT_UI_PREFERENCES = {
  activeTab: "editor",
  showSchema: false,
  darkMode: false,
};

/**
 * Build a safe UI preference payload from partially trusted input.
 */
export function normalizeUiPreferences(input = {}, availableTabs = []) {
  const validTabIds = new Set((availableTabs ?? []).map((tab) => tab.id));
  const requestedTab = input?.activeTab;
  return {
    activeTab: validTabIds.has(requestedTab)
      ? requestedTab
      : DEFAULT_UI_PREFERENCES.activeTab,
    showSchema: Boolean(input?.showSchema),
    darkMode: Boolean(input?.darkMode),
  };
}

/**
 * Parse persisted UI preferences from storage while handling malformed values.
 */
export function parseUiPreferences(rawValue, availableTabs = []) {
  if (!rawValue) return { ...DEFAULT_UI_PREFERENCES };
  try {
    const parsed = JSON.parse(rawValue);
    return normalizeUiPreferences(parsed, availableTabs);
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function serializeUiPreferences(preferences) {
  return JSON.stringify({
    activeTab: preferences.activeTab,
    showSchema: Boolean(preferences.showSchema),
    darkMode: Boolean(preferences.darkMode),
    savedAt: new Date().toISOString(),
  });
}

export { DEFAULT_UI_PREFERENCES };
