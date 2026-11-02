"""Small HTTP client used by the JobPilot Playwright worker.

The worker never receives database credentials or user session cookies. It only
uses the shared WORKER_TOKEN and short-lived task/document endpoints.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger("jobpilot.client")


class WorkerApiError(RuntimeError):
    pass


class AppClient:
    def __init__(self, base_url: str, token: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.timeout = timeout

    @property
    def headers(self) -> dict[str, str]:
        return {
            "x-worker-token": self.token,
            "content-type": "application/json",
            "user-agent": "JobPilot-Worker/1.0",
        }

    async def heartbeat(self, status: str = "online", meta: dict[str, Any] | None = None) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/automation/worker",
                json={"token": self.token, "status": status, "meta": meta or {}},
                headers=self.headers,
            )
            if response.status_code >= 400:
                raise WorkerApiError(f"Heartbeat failed ({response.status_code}): {response.text[:300]}")
            return response.json()

    async def claim(self) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/automation/worker/tasks/claim",
                json={},
                headers=self.headers,
            )
            if response.status_code == 401:
                raise WorkerApiError("Worker token was rejected. Check WORKER_TOKEN on both Vercel and the worker.")
            if response.status_code == 422:
                # The task was claimed but its payload is invalid. The app has
                # already marked it failed, so continue polling.
                logger.warning("Claimed task could not be prepared: %s", response.text[:500])
                return None
            if response.status_code >= 400:
                raise WorkerApiError(f"Claim failed ({response.status_code}): {response.text[:300]}")
            data = response.json()
            return data.get("task")

    async def download(self, url: str, destination: Path) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
            response = await client.get(url, headers=self.headers)
            if response.status_code >= 400:
                raise WorkerApiError(f"Document download failed ({response.status_code}): {response.text[:200]}")
            destination.write_bytes(response.content)
        return destination

    async def report(
        self,
        task_id: str,
        status: str,
        message: str,
        *,
        confirmation: str | None = None,
        final_url: str | None = None,
        fields_filled: list[str] | None = None,
        screenshot_path: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "status": status,
            "message": message[:4000],
            "confirmation": confirmation,
            "finalUrl": final_url,
            "fieldsFilled": fields_filled or [],
            "screenshotPath": screenshot_path,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/automation/worker/tasks/{task_id}/result",
                json=payload,
                headers=self.headers,
            )
            if response.status_code >= 400:
                raise WorkerApiError(f"Result report failed ({response.status_code}): {response.text[:300]}")
            return response.json()
