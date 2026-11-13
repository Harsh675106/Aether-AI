# YouTube commands

YouTube requests from text and transcribed voice pass through Aether's existing
chat orchestrator. `YouTubeCommandRouter` dispatches supported requests to
`YouTubeManager`, which uses the injected centralized `BrowserManager`; it
does not launch a browser, create a page, or create a separate session.

Supported operations include major YouTube section navigation, public search
result extraction and follow-up selection, visible authenticated history
reading, common video controls, and current-video information. Search and
history output is limited to metadata currently rendered by YouTube.

Account-changing actions (playlist edits, subscriptions, deletion, and history
clearing), channel-specific operations, reliable view-count ranking, caption
language selection, and transcript-based summaries are not implemented. They
are not simulated; unsupported account changes return a transparent response.
History and personalized sections require the user to be signed in through the
existing Aether Floating Browser. No YouTube Data API key is required or used.

The test suite uses a browser-manager test double. Tests requiring a real
authenticated YouTube account or the interactive floating-browser window must
be run manually; automated tests do not alter user account data.
