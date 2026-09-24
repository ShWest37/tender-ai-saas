"""Системные эндпоинты: liveness и метрики Prometheus."""
import pytest


async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_metrics(client):
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    # В ответе должны присутствовать метрики prometheus-client
    assert "http_requests_total" in resp.text or "# HELP" in resp.text
