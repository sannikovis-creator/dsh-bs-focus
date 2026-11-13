# Session focus

Session focus adds a separate compact view of recent sessions without changing the built-in DSH list modes.

## Usage

Choose **Focus** in the sidebar footer. The period button opens filters for 3 hours, 6 hours, 1 day, 3 days, or all sessions. `▦` groups cards by Workspace, while `Aa` shows stable colored labels made from the final two project folders.

Sessions are ordered from newest to oldest. When grouping is enabled, projects are also ordered by their newest session. Each card shows its title, project, and compact activity time. Blue, orange, yellow, teal, and green card colors identify current states. A completed response that has not been opened gains a dedicated **UNREAD** line.

Select a card to open it, use its actions button for the standard DSH session menu, or use the arrow at the top to return to the built-in browser. The mode, period, grouping, and label preferences are stored in the current browser.

## Limitations

DSH exposes no public extension slot inside the built-in browser header, so Focus is entered from the sidebar footer. DSH clears its unread-completion state when the session is opened, and that state does not survive a full client-page reload.
