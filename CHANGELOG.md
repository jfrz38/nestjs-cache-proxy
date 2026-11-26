# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- git-cliff: end of header -->

## [Unreleased]

### Added

- **policy:** Add typed cache policy API
- **key:** Add deterministic cache key contract
- **runtime:** Add cache-aside proxy
- Add NestJS cached provider integration
- Add dynamic cache proxy modules
- **policy:** Validate and compile mutation cache effects
- **runtime:** Execute source-first cache effects
- **runtime:** Add resilient cache value handling
- **nest:** Expose cache error hook
- Add deterministic testing API
- Add cache admission events
- Add CODEOWNERS file for repository ownership

### Fixed

- Resolve Nest constants in ESM consumers
- Decouple testing API from cache-manager types
- Preserve cache policy resource inference

### Changed

- **core:** Encapsulate runtime behavior
- Encapsulate cache integration logic
- Split cache policy validation
- Simplify architecture lint configuration
- Organize source by architecture layer
- Use default architecture lint layers
- **runtime:** Clarify cache policy execution types
- **policy:** Clarify cache effect types
- **errors:** Extract error metadata constants
- Simplify cache event contract
- Enforce cache proxy layer boundaries
- Verify release-ready package
- Automate releases and npm publishing
- Run full checks for main pull requests
- Fix examples code check
- Reduce CI usage when merge to develop
- Validate declared peer compatibility
- Stabilize pnpm setup and dependency updates
- Scope npm package under jfrz38
- Align Node and TypeScript compatibility
- Verify Redis backend compatibility
- Format changelog
