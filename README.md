# pandoc-web

A simple web application that converts Markdown text to PDF using Pandoc. Paste your Markdown text into the web interface, or drag and drop a `.md` file, and get a PDF in return.

## Getting Started

### Using Docker Compose:

1. Start the application:
   ```bash
   docker-compose up --build
   ```

2. Open <http://localhost:3000> in your browser

### Using Kubernetes:

1. Deploy to your Kubernetes cluster:
   ```bash
   kubectl apply -f k8s-deployment.yaml
   ```

2. Access the application:
   - If using a LoadBalancer: Check the external IP with `kubectl get svc pandoc-web-service`
   - If using port-forward: `kubectl port-forward deployment/pandoc-web 3000:3000`
   - Then open <http://localhost:3000> in your browser

Instead of building the images locally, you can also pull the pre-built images from GitHub Container Registry. Update your `docker-compose.yml` to use:

* `    image: ghcr.io/mpepping/pandoc-web-app:latest`
* `    image: ghcr.io/mpepping/pandoc-web-api:latest`

## Requirements

- Docker and Docker Compose (for Docker deployment)
- Kubernetes cluster with kubectl (for Kubernetes deployment)
- Node.js (if running manually)

The application uses the `ghcr.io/mpepping/pandoc:latest` Docker image for PDF conversion using Pandoc.
