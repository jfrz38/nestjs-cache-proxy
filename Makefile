PNPM ?= pnpm
PACKAGE_DIR := code

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "%-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install locked dependencies
	$(PNPM) --dir "$(PACKAGE_DIR)" install --frozen-lockfile

.PHONY: format format-check lint typecheck test test-backend test-backend-redis test-backend-all test-coverage build pack-check
format: ## Format source code and documentation
	$(PNPM) --dir "$(PACKAGE_DIR)" run format

format-check: ## Check source code and documentation formatting
	$(PNPM) --dir "$(PACKAGE_DIR)" run format:check

lint: ## Lint TypeScript and Markdown
	$(PNPM) --dir "$(PACKAGE_DIR)" run lint

typecheck: ## Type-check without emitting files
	$(PNPM) --dir "$(PACKAGE_DIR)" run typecheck

test: ## Run unit tests
	$(PNPM) --dir "$(PACKAGE_DIR)" run test

test-backend: ## Run the memory backend compatibility contract
	$(PNPM) --dir "$(PACKAGE_DIR)" run test:backend

test-backend-redis: ## Run the Redis backend compatibility contract with Docker
	$(PNPM) --dir "$(PACKAGE_DIR)" run test:backend:redis

test-backend-all: ## Run memory and Redis backend compatibility contracts
	$(PNPM) --dir "$(PACKAGE_DIR)" run test:backend:all

test-coverage: ## Run unit tests with coverage reporting
	$(PNPM) --dir "$(PACKAGE_DIR)" run test:coverage

build: ## Build ESM, CommonJS, declarations, and source maps
	$(PNPM) --dir "$(PACKAGE_DIR)" run build

pack-check: ## Verify the packed tarball with ESM, CommonJS, and TypeScript consumers
	$(PNPM) --dir "$(PACKAGE_DIR)" run pack:check

.PHONY: check
check: format-check lint typecheck test build pack-check ## Run all project checks
