# pandoc-web

A simple web application that converts Markdown text to PDF using Pandoc. Paste your Markdown text into the web interface, or drag and drop a `.md` file, and get a PDF in return.

## Getting Started

Using Docker Compose (Recommended):

1. Start the application:
   ```bash
   docker-compose up --build
   ```

2. Open <http://localhost:3000> in your browser

Instead of building the images locally, you can also pull the pre-built images from GitHub Container Registry:

* ghcr.io/mpepping/pandoc-web-app:latest
* ghcr.io/mpepping/pandoc-web-api:latest

## Requirements

- Docker and Docker Compose
- Node.js (if running manually)

The application uses the `ghcr.io/mpepping/pandoc:latest` Docker image for PDF conversion using Pandoc.
