"""Telemetry provider boundary; never fabricate operational measurements."""

from typing import Any


class TelemetryProvider: 
    async def query_cluster_metrics(self, region: list[str] | str | None = None) -> dict[str, Any]:
        return {
            "status": "UNAVAILABLE",
            "provider": None,
            "region": region,
            "message": "No telemetry provider is configured; system health is unknown.",
            "metrics": None,
            "active_incident": None,
        }


telemetry_client = TelemetryProvider()
