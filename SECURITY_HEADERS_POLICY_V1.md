# Security Headers Policy V1

Production SaaS target: Netlify.

Required response protections are configured in `netlify.toml`: Content-Security-Policy, frame protection, MIME sniffing protection, referrer policy, permissions policy and HSTS. API responses remain private/no-store where implemented.

This document is informational; `netlify.toml` is the deploy-time source of truth for static response headers.
