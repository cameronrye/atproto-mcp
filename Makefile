# AT Protocol MCP Server - Makefile
# Comprehensive build system for development, testing, and deployment

# Configuration
SHELL := /bin/bash
.DEFAULT_GOAL := help
.ONESHELL:

# Project variables
PROJECT_NAME := atproto-mcp
DOCKER_IMAGE := $(PROJECT_NAME)
DOCKER_TAG := latest
DOCKER_CONTAINER := $(PROJECT_NAME)-server
COMPOSE_FILE := docker-compose.yml

# Package manager
PKG_MANAGER := pnpm

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
RESET := \033[0m

# Check if pnpm is installed and provide helpful guidance
check-pnpm:
	@if ! command -v $(PKG_MANAGER) >/dev/null 2>&1; then \
		printf "\n$(RED)Error: pnpm is not installed$(RESET)\n\n"; \
		printf "$(YELLOW)To install pnpm, choose one of these options:$(RESET)\n"; \
		printf "  1. Using npm:     $(BLUE)npm install -g pnpm$(RESET)\n"; \
		printf "  2. Using curl:    $(BLUE)curl -fsSL https://get.pnpm.io/install.sh | sh -$(RESET)\n"; \
		printf "  3. Using Homebrew: $(BLUE)brew install pnpm$(RESET)\n"; \
		printf "  4. Using Corepack: $(BLUE)corepack enable && corepack prepare pnpm@latest --activate$(RESET)\n\n"; \
		printf "$(YELLOW)Alternatively, you can use npm instead by running:$(RESET)\n"; \
		printf "  $(BLUE)make PKG_MANAGER=npm <target>$(RESET)\n\n"; \
		printf "$(YELLOW)For more information, visit: https://pnpm.io/installation$(RESET)\n\n"; \
		exit 1; \
	fi

# Define a shell function to run package manager commands with fallback
define run_pkg_cmd
	@if [ "$(PKG_MANAGER)" = "pnpm" ] && ! command -v pnpm >/dev/null 2>&1; then \
		printf "\n$(YELLOW)pnpm not found, checking for alternatives...$(RESET)\n"; \
		if command -v npm >/dev/null 2>&1; then \
			printf "$(GREEN)Using npm instead$(RESET)\n"; \
			printf "$(BLUE)Tip: To use npm permanently, run: export PKG_MANAGER=npm$(RESET)\n\n"; \
			npm $(1); \
		elif command -v yarn >/dev/null 2>&1; then \
			printf "$(GREEN)Using yarn instead$(RESET)\n"; \
			printf "$(BLUE)Tip: To use yarn permanently, run: export PKG_MANAGER=yarn$(RESET)\n\n"; \
			yarn $(1); \
		else \
			$(MAKE) check-pnpm; \
			exit 1; \
		fi \
	elif ! command -v $(PKG_MANAGER) >/dev/null 2>&1; then \
		printf "\n$(RED)Error: $(PKG_MANAGER) is not installed$(RESET)\n"; \
		printf "$(YELLOW)Please install $(PKG_MANAGER) or use a different package manager$(RESET)\n\n"; \
		exit 1; \
	else \
		$(PKG_MANAGER) $(1); \
	fi
endef

# Smart package manager check with fallback
check-pkg-manager:
	@if [ "$(PKG_MANAGER)" = "pnpm" ] && ! command -v pnpm >/dev/null 2>&1; then \
		if ! command -v npm >/dev/null 2>&1 && ! command -v yarn >/dev/null 2>&1; then \
			$(MAKE) check-pnpm; \
			exit 1; \
		fi \
	elif ! command -v $(PKG_MANAGER) >/dev/null 2>&1; then \
		printf "\n$(RED)Error: $(PKG_MANAGER) is not installed$(RESET)\n"; \
		printf "$(YELLOW)Please install $(PKG_MANAGER) or use a different package manager$(RESET)\n\n"; \
		exit 1; \
	fi

##@ Help
.PHONY: help
help: ## Display this help message
	@echo "$(BLUE)AT Protocol MCP Server - Build System$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(BLUE)<target>$(RESET)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(BLUE)%-20s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development
.PHONY: install
install: check-pkg-manager ## Install all dependencies
	@echo "$(GREEN)Installing dependencies...$(RESET)"
	$(call run_pkg_cmd,install)

.PHONY: dev
dev: check-pkg-manager ## Start development server with hot reload
	@echo "$(GREEN)Starting development server...$(RESET)"
	$(call run_pkg_cmd,run dev)

.PHONY: build
build: check-pkg-manager ## Build the project for production
	@echo "$(GREEN)Building project...$(RESET)"
	$(call run_pkg_cmd,run build)

.PHONY: start
start: check-pkg-manager ## Start the production server
	@echo "$(GREEN)Starting production server...$(RESET)"
	$(call run_pkg_cmd,run start)

.PHONY: clean
clean: ## Clean build artifacts
	@echo "$(GREEN)Cleaning build artifacts...$(RESET)"
	$(PKG_MANAGER) run clean

.PHONY: clean-all
clean-all: clean ## Clean all generated files including node_modules
	@echo "$(GREEN)Cleaning all generated files...$(RESET)"
	rm -rf node_modules
	rm -rf .pnpm-store
	rm -f pnpm-lock.yaml

##@ Testing & Quality
.PHONY: test
test: check-pkg-manager ## Run all tests
	@echo "$(GREEN)Running tests...$(RESET)"
	$(PKG_MANAGER) run test

.PHONY: test-coverage
test-coverage: check-pkg-manager ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(RESET)"
	$(PKG_MANAGER) run test:coverage

.PHONY: test-ui
test-ui: check-pkg-manager ## Run tests with UI interface
	@echo "$(GREEN)Starting test UI...$(RESET)"
	$(PKG_MANAGER) run test:ui

.PHONY: lint
lint: check-pkg-manager ## Run ESLint
	@echo "$(GREEN)Running linter...$(RESET)"
	$(PKG_MANAGER) run lint

.PHONY: lint-fix
lint-fix: check-pkg-manager ## Run ESLint with auto-fix
	@echo "$(GREEN)Running linter with auto-fix...$(RESET)"
	$(PKG_MANAGER) run lint:fix

.PHONY: format
format: check-pkg-manager ## Format code with Prettier
	@echo "$(GREEN)Formatting code...$(RESET)"
	$(PKG_MANAGER) run format

.PHONY: format-check
format-check: check-pkg-manager ## Check code formatting
	@echo "$(GREEN)Checking code formatting...$(RESET)"
	$(PKG_MANAGER) run format:check

.PHONY: type-check
type-check: check-pkg-manager ## Run TypeScript type checking
	@echo "$(GREEN)Running type check...$(RESET)"
	$(PKG_MANAGER) run type-check

.PHONY: check
check: lint format-check type-check test ## Run all quality checks
	@echo "$(GREEN)All quality checks completed successfully!$(RESET)"

##@ Documentation
.PHONY: docs-dev
docs-dev: check-pkg-manager ## Start documentation development server
	@echo "$(GREEN)Starting documentation development server...$(RESET)"
	$(PKG_MANAGER) run docs:dev

.PHONY: docs-build
docs-build: check-pkg-manager ## Build documentation for production
	@echo "$(GREEN)Building documentation...$(RESET)"
	$(PKG_MANAGER) run docs:build

.PHONY: docs-preview
docs-preview: check-pkg-manager ## Preview built documentation
	@echo "$(GREEN)Previewing documentation...$(RESET)"
	$(PKG_MANAGER) run docs:preview

##@ Docker
.PHONY: docker-build
docker-build: ## Build Docker image
	@echo "$(GREEN)Building Docker image...$(RESET)"
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

.PHONY: docker-run
docker-run: ## Run Docker container
	@echo "$(GREEN)Running Docker container...$(RESET)"
	docker run -d --name $(DOCKER_CONTAINER) -p 3000:3000 $(DOCKER_IMAGE):$(DOCKER_TAG)

.PHONY: docker-stop
docker-stop: ## Stop Docker container
	@echo "$(GREEN)Stopping Docker container...$(RESET)"
	docker stop $(DOCKER_CONTAINER) || true
	docker rm $(DOCKER_CONTAINER) || true

.PHONY: docker-logs
docker-logs: ## View Docker container logs
	@echo "$(GREEN)Viewing Docker container logs...$(RESET)"
	docker logs -f $(DOCKER_CONTAINER)

.PHONY: docker-shell
docker-shell: ## Get shell access to Docker container
	@echo "$(GREEN)Opening shell in Docker container...$(RESET)"
	docker exec -it $(DOCKER_CONTAINER) /bin/sh

.PHONY: docker-up
docker-up: ## Start all services with docker-compose
	@echo "$(GREEN)Starting all services with docker-compose...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) up -d

.PHONY: docker-down
docker-down: ## Stop all services with docker-compose
	@echo "$(GREEN)Stopping all services with docker-compose...$(RESET)"
	docker-compose -f $(COMPOSE_FILE) down

.PHONY: docker-restart
docker-restart: docker-down docker-up ## Restart all Docker services

##@ CI/CD
.PHONY: ci
ci: install check build ## Run CI pipeline locally
	@echo "$(GREEN)CI pipeline completed successfully!$(RESET)"

.PHONY: prepare
prepare: check-pkg-manager ## Prepare development environment
	@echo "$(GREEN)Preparing development environment...$(RESET)"
	$(PKG_MANAGER) run prepare

##@ Utility
.PHONY: install-pnpm
install-pnpm: ## Install pnpm using the best available method
	@echo "$(GREEN)Installing pnpm...$(RESET)"
	@if command -v npm >/dev/null 2>&1; then \
		echo "$(BLUE)Installing pnpm via npm...$(RESET)"; \
		npm install -g pnpm; \
	elif command -v curl >/dev/null 2>&1; then \
		echo "$(BLUE)Installing pnpm via curl...$(RESET)"; \
		curl -fsSL https://get.pnpm.io/install.sh | sh -; \
	elif command -v brew >/dev/null 2>&1; then \
		echo "$(BLUE)Installing pnpm via Homebrew...$(RESET)"; \
		brew install pnpm; \
	else \
		printf "$(RED)Error: No suitable installation method found$(RESET)\n"; \
		printf "$(YELLOW)Please install Node.js/npm, curl, or Homebrew first$(RESET)\n"; \
		exit 1; \
	fi
	@echo "$(GREEN)pnpm installation completed!$(RESET)"
	@echo "$(YELLOW)You may need to restart your terminal or run 'source ~/.bashrc' (or ~/.zshrc)$(RESET)"

.PHONY: status
status: ## Show project status
	@echo "$(BLUE)Project Status:$(RESET)"
	@echo "  Name: $(PROJECT_NAME)"
	@echo "  Package Manager: $(PKG_MANAGER)"
	@echo "  Node Version: $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "  pnpm Version: $$($(PKG_MANAGER) --version 2>/dev/null || echo 'Not installed')"
	@echo "  Docker Version: $$(docker --version 2>/dev/null || echo 'Not installed')"
	@echo ""
	@echo "$(BLUE)Available Scripts:$(RESET)"
	@$(PKG_MANAGER) run --silent 2>/dev/null | grep -E "^  " || echo "  No scripts found"

.PHONY: deps-update
deps-update: check-pkg-manager ## Update all dependencies
	@echo "$(GREEN)Updating dependencies...$(RESET)"
	$(PKG_MANAGER) update

.PHONY: deps-audit
deps-audit: check-pkg-manager ## Audit dependencies for security issues
	@echo "$(GREEN)Auditing dependencies...$(RESET)"
	$(PKG_MANAGER) audit

# Declare all targets as phony
.PHONY: check-pnpm check-pkg-manager get-pkg-manager install-pnpm help install dev build start clean clean-all test test-coverage test-ui lint lint-fix format format-check type-check check docs-dev docs-build docs-preview docker-build docker-run docker-stop docker-logs docker-shell docker-up docker-down docker-restart ci prepare status deps-update deps-audit
