# pandoc-web

A simple web application that converts markdown text to PDF using Pandoc running in a Docker container.

## Features

- Web-based markdown editor with sample content
- Convert markdown to PDF using Pandoc
- Portrait and landscape orientation support
- Dockerized architecture with separate web and API services
- Health checks and automatic container restarts

## Architecture

The application consists of two Docker services:
- **Web service**: Express.js frontend serving the web interface
- **API service**: Pandoc conversion service running in a specialized container

## Quick Start

### Using Docker Compose (Recommended)

1. Start the application:
   ```bash
   docker-compose up --build
   ```

2. Open http://localhost:3000 in your browser

### Manual Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the web server:
   ```bash
   npm start
   ```

3. Ensure the pandoc service is running on port 8080

## Requirements

- Docker and Docker Compose
- Node.js (if running manually)

The application uses the `ghcr.io/mpepping/pandoc:latest` Docker image with custom Node.js service for conversions.
