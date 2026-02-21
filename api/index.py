"""
Vercel serverless entry-point.

This is a thin wrapper that re-exports the FastAPI ``app`` from
``backend.main`` so that there is a single source of truth for all
API routes.  Vercel auto-discovers this file at ``api/index.py``
and uses it to handle ``/api/*`` and (via rewrites) ``/auth/*`` requests.
"""

import os
import sys

# Ensure the project root is on sys.path so ``backend.*`` imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: F401 – re-export for Vercel

