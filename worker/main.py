"""JobPilot Playwright worker.

Deploy this as a long-running service (Render, Fly.io, Railway, Docker, VPS).
It polls the JobPilot app for approved browser applications, fills the public
form, and reports a truthful result. It never bypasses CAPTCHAs, MFA, login
walls, or account creation.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from automation import Outcome, run_application
from client import AppClient, WorkerApiError

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("jobpilot.worker")

APP_URL = os.getenv("APP_URL", "http://localhost:3000").rstrip("/")
WORKER_TOKEN = os.getenv("WORKER_TOKEN", "").strip()
if not WORKER_TOKEN:
    raise RuntimeError("WORKER_TOKEN is required. Set it to the same value configured on the JobPilot app.")
POLL_INTERVAL = max(3.0, float(os.getenv("POLL_INTERVAL_SECONDS", "15")))
ENABLE_POLLER = os.getenv("ENABLE_POLLER", "true").lower() not in {"0", "false", "no"}
DRY_RUN = os.getenv("DRY_RUN", "false").lower() in {"1", "true", "yes"}
VERSION = "1.1.0"

client = AppClient(APP_URL, WORKER_TOKEN)
_poll_task: asyncio.Task[None] | None = None


def _meta() -> dict[str, Any]:
    return {
        "version": VERSION,
        "pollIntervalSeconds": POLL_INTERVAL,
        "dryRun": DRY_RUN,
        "headless": os.getenv("HEADLESS", "true"),
        "workerMode": "poll",
    }


def _safe_filename(value: str) -> str:
    name = Path(value or "document.pdf").name
    name = re.sub(r"[^a-zA-Z0-9._-]", "-", name)
    return name[:120] or "document.pdf"


async def process_task(task: dict[str, Any]) -> dict[str, Any]:
    task_id = str((task.get("task") or {}).get("id") or "")
    if not task_id:
        raise WorkerApiError("Claimed task had no id.")

    work_dir = Path(tempfile.mkdtemp(prefix="jobpilot-"))
    document_paths: dict[str, str] = {}
    try:
        for document in task.get("documents") or []:
            document_id = str(document.get("id") or "")
            url = str(document.get("downloadUrl") or "")
            if not document_id or not url:
                continue
            destination = work_dir / _safe_filename(str(document.get("filename") or f"{document_id}.pdf"))
            await client.download(url, destination)
            document_paths[document_id] = str(destination)

        outcome: Outcome = await run_application(task, document_paths, dry_run=DRY_RUN)
        await client.report(
            task_id,
            outcome.status,
            outcome.message,
            confirmation=outcome.confirmation,
            final_url=outcome.final_url,
            fields_filled=outcome.fields_filled,
            screenshot_path=outcome.screenshot_path,
        )
        logger.info("task %s finished: %s", task_id, outcome.status)
        return {
            "taskId": task_id,
            "status": outcome.status,
            "message": outcome.message,
            "fieldsFilled": outcome.fields_filled,
        }
    except Exception as error:  # noqa: BLE001 - report the failure instead of silently dying
        logger.exception("task %s crashed", task_id)
        try:
            await client.report(task_id, "failed", f"Worker error: {str(error)[:1000]}")
        except Exception:  # noqa: BLE001
            logger.exception("could not report task %s failure", task_id)
        return {"taskId": task_id, "status": "failed", "message": str(error)[:1000]}
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


async def poll_loop() -> None:
    logger.info("worker polling %s every %.0fs", APP_URL, POLL_INTERVAL)
    while True:
        try:
            await client.heartbeat("online", _meta())
            task = await client.claim()
            if task:
                await process_task(task)
                continue
        except asyncio.CancelledError:
            raise
        except Exception as error:  # noqa: BLE001 - keep the worker alive
            logger.warning("poll failed: %s", error)
            try:
                meta = _meta()
                meta["lastError"] = str(error)[:300]
                await client.heartbeat("online", meta)
            except Exception:  # noqa: BLE001
                logger.warning("heartbeat failed too")
        await asyncio.sleep(POLL_INTERVAL)


@asynccontextmanager
async def lifespan(_: FastAPI):
    global _poll_task
    if ENABLE_POLLER:
        _poll_task = asyncio.create_task(poll_loop())
    yield
    if _poll_task:
        _poll_task.cancel()
        try:
            await _poll_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="JobPilot Playwright Worker", version=VERSION, lifespan=lifespan)


class HeartbeatPayload(BaseModel):
    status: str = "online"
    meta: dict[str, Any] = Field(default_factory=dict)


class DirectApplyPayload(BaseModel):
    applicationUrl: str
    candidate: dict[str, Any] = Field(default_factory=dict)
    job: dict[str, Any] = Field(default_factory=dict)
    answers: list[dict[str, Any]] = Field(default_factory=list)
    submit: bool = False
    taskId: str = "direct"


def _require_token(x_worker_token: str | None, authorization: str | None = None) -> None:
    provided = x_worker_token or ""
    if not provided and authorization:
        provided = re.sub(r"^Bearer\s+", "", authorization, flags=re.IGNORECASE)
    if not provided or provided != WORKER_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid worker token")


@app.get("/health")
def health() -> dict[str, Any]:
    try:
        import playwright  # noqa: F401
        playwright_available = True
    except Exception:
        playwright_available = False
    return {
        "status": "ok",
        "service": "jobpilot-playwright-worker",
        "version": VERSION,
        "polling": bool(_poll_task and not _poll_task.done()),
        "playwrightAvailable": playwright_available,
        "dryRun": DRY_RUN,
        "appUrl": APP_URL,
    }


@app.post("/heartbeat")
async def heartbeat(payload: HeartbeatPayload, x_worker_token: str | None = Header(default=None)) -> dict[str, Any]:
    _require_token(x_worker_token)
    await client.heartbeat(payload.status, payload.meta)
    return {"ok": True}


@app.post("/run-once")
async def run_once(x_worker_token: str | None = Header(default=None)) -> dict[str, Any]:
    _require_token(x_worker_token)
    task = await client.claim()
    if not task:
        return {"ok": True, "task": None}
    return {"ok": True, "result": await process_task(task)}


@app.post("/apply")
async def apply(payload: DirectApplyPayload, x_worker_token: str | None = Header(default=None)) -> dict[str, Any]:
    _require_token(x_worker_token)
    task = {
        "task": {"id": payload.taskId, "attempts": 1, "maxAttempts": 1},
        "job": {"applicationUrl": payload.applicationUrl, **payload.job},
        "candidate": payload.candidate,
        "answers": payload.answers,
        "documents": [],
        "submit": payload.submit,
    }
    outcome = await run_application(task, {}, dry_run=DRY_RUN)
    return {
        "status": outcome.status,
        "message": outcome.message,
        "confirmation": outcome.confirmation,
        "finalUrl": outcome.final_url,
        "fieldsFilled": outcome.fields_filled,
        "screenshotPath": outcome.screenshot_path,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
