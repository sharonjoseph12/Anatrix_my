# Firecracker sandbox service

Standalone WebSocket service for collaborative Go and Rust rooms. Phase 0 provides
the deployable service boundary and health endpoint; VM allocation is implemented
in tasks T060-T064.

Liveblocks, LiveKit, and Fly credentials must be stored in the production secret
manager (1Password for operators, platform secrets for workloads), never in Git.
Rotate service credentials every 90 days and immediately after personnel or access
changes.
