# Docker

Docker and Compose files for the application services and local infrastructure.

## SearXNG video search

The backend sends searches to `SEARXNG_BASE_URL` (default
`http://localhost:8080`) using SearXNG's `videos` category and JSON response
format. The local configuration in `searxng/settings.yml` enables the
YouTube, Dailymotion, and Vimeo engines. Enable at least one video-category
engine in your own SearXNG instance for video results; no search credentials
are required by Aether's frontend.

