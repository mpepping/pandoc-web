# vim:ft=make:

APP_NAME=pandoc-web
OS_NAME := $(shell uname -s | tr A-Z a-z)

# Auto-detect container runtime
CONTAINER_RUNTIME := $(shell which container 2>/dev/null || which docker 2>/dev/null || which podman 2>/dev/null || echo "")

ifeq ($(CONTAINER_RUNTIME),)
$(error No docker, podman or container found in PATH)
endif

# Detect compose command
COMPOSE := $(shell $(CONTAINER_RUNTIME) compose version >/dev/null 2>&1 && echo "$(CONTAINER_RUNTIME) compose" || echo "docker-compose")

.PHONY: help
help: ## This help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

install: ## Install Node.js dependencies
	npm install

dev: ## Start the development server locally
	npm start

build: ## Build the container images
	$(COMPOSE) build

up: ## Start the application stack
	$(COMPOSE) up -d

down: ## Stop the application stack
	$(COMPOSE) down

logs: ## Show container logs (follow)
	$(COMPOSE) logs -f

ps: ## Show running containers
	$(COMPOSE) ps

restart: ## Restart the application stack
	$(COMPOSE) restart

clean: ## Stop and remove containers, volumes, and images
	$(COMPOSE) down -v --rmi local

runtime: ## Show detected container runtime and OS
	@echo "Using container runtime: $(CONTAINER_RUNTIME) on $(OS_NAME)"
	@echo "Using compose command: $(COMPOSE)"
