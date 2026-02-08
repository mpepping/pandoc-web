# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pandoc-web is a simple web application that allows users to paste markdown text in a text area and convert it to various formats using Pandoc. On the backend it should run `ghcr.io/mpepping/pandoc:latest` in a container to perform the conversion. It is OK that the webapp runs locally on the host, but the pandoc conversion must run in a container.

## Development Commands

- `npm install` - Install dependencies
- `npm start` - Start the web server on port 3000
- `npm run dev` - Start development server (same as start)

## Architecture

### Frontend (index.html)
- Single-page web application with HTML, CSS, and JavaScript
- Textarea for markdown input with sample content
- Convert button that sends POST request to `/convert` endpoint
- Automatic PDF download on successful conversion
- Status messages for user feedback

### Backend (server.js)
- Express.js server serving static files and handling API requests
- `/convert` endpoint accepts JSON with markdown content
- Creates temporary files with UUID-based naming
- Executes pandoc conversion using Docker container
- Streams PDF response and cleans up temporary files
- `/health` endpoint for status monitoring

### Docker Integration
- Uses `ghcr.io/mpepping/pandoc:latest` container image
- Mounts temp directory as `/workspace` volume
- Converts markdown to PDF format
- Container runs with `--rm` flag for automatic cleanup

### File Structure
```
/
├── index.html          # Frontend web interface
├── server.js           # Backend Express server
├── package.json        # Node.js dependencies
├── .gitignore         # Git ignore patterns
├── CLAUDE.md          # This file
└── temp/              # Temporary files (auto-created)

