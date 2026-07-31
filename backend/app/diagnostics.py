from __future__ import annotations


def rss_mb() -> str:
    """Current resident memory in MB on Linux, with a peak-RSS fallback."""
    try:
        with open("/proc/self/status", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    kb = int(line.split()[1])
                    return f"{kb // 1024}MB"
    except Exception:  # noqa: BLE001 - diagnostics only
        pass
    try:
        import resource

        return f"{resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024}MB peak"
    except Exception:  # noqa: BLE001 - not available on Windows; diagnostics only
        return "n/a"
