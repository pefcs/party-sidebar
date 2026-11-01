# Changelog

## 1.2.0
- Added an on-screen toolbar for layout controls.
- Added draggable free positioning and a lock/unlock control.
- Right-clicking the lock control re-docks the sidebar beside Foundry's right sidebar.
- Added horizontal and vertical layout switching.
- Saved layout preferences per client.
- Kept portrait size and docked vertical offset settings in the module configuration.

## 1.2.1
- Reworked the on-screen toolbar into a compact two-column layout.
- Toolbar controls are visible only while hovering over or focusing the party sidebar.
- Replaced the up/down nudge buttons with a configuration popup.
- Added live portrait-size and vertical-position sliders to the popup.
- The toolbar configuration button now opens the popup instead of Foundry's module settings.

## 1.2.2
- Anchored the configuration popup to the viewport so it stays in place while the sidebar moves.
- Portrait-size slider now resizes existing portrait elements immediately without rebuilding the sidebar.
- Lock and unlock states now use distinct icons, tooltips, and styling.
- Orientation switching now updates the existing sidebar layout directly without a full actor/portrait rebuild.

## 1.2.3
- Added a toolbar control to collapse the party sidebar into a single party icon.
- Clicking the collapsed icon restores the full party sidebar.
- Collapsed/expanded state is saved per client and persists across reloads.

## 1.2.4
- Updated the Party Sidebar visual theme to match Action HUD and Roll Director.
- Unified charcoal surfaces, slate borders, teal accents, warm gold highlights, and interaction states across the toolbar, popup, portrait labels, and collapsed icon.
