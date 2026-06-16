"""caw v2 durable layer — operational state agents produce and query.

Stdlib only (sqlite3 + argparse). Policy lives in markdown rules; this package
is the queryable record of what agents did. Shape mirrors repository-harness so
a future Rust rewrite migrates 1:1.
"""

__version__ = "2.0.0"

__all__ = ["db", "domain", "render", "__version__"]
