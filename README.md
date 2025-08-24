# pandoc-web

A simple web application that converts markdown text to various formats using Pandoc in a Docker container.

## Features

- Web-based markdown editor
- Convert markdown to PDF using Pandoc

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open http://localhost:3000 in your browser

## Requirements

- Node.js
- Docker (for pandoc conversion)

The application uses the `ghcr.io/mpepping/pandoc:latest` Docker image for conversions.
