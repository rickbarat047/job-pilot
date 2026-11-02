"""Truthful, permission-respecting browser automation for JobPilot.

The worker only fills forms the candidate explicitly approved. It stops before
CAPTCHAs, MFA, login walls, account creation, or any page it cannot verify, and
reports `manual_required` instead of pretending the application succeeded.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from playwright.async_api import Browser, Page, TimeoutError as PlaywrightTimeoutError, async_playwright

logger = logging.getLogger("jobpilot.automation")

HEADLESS = os.getenv("HEADLESS", "true").lower() not in {"0", "false", "no"}
SCREENSHOT_DIR = Path(os.getenv("SCREENSHOT_DIR", "/tmp/jobpilot-screenshots"))
NAV_TIMEOUT_MS = int(os.getenv("WORKER_NAV_TIMEOUT_MS", "45000"))
ACTION_TIMEOUT_MS = int(os.getenv("WORKER_ACTION_TIMEOUT_MS", "12000"))

LOGIN_HOSTS = {
    "login.microsoftonline.com",
    "accounts.google.com",
    "login.live.com",
    "auth0.com",
    "okta.com",
    "workday.com",
}

CAPTCHA_SELECTORS = [
    'iframe[src*="recaptcha" i]',
    'iframe[src*="hcaptcha" i]',
    'iframe[src*="turnstile" i]',
    'div[class*="hcaptcha" i]',
    'div[class*="cf-turnstile" i]',
    '[data-sitekey]',
]

BLOCKER_TEXT = [
    "verify you are human",
    "complete the captcha",
    "please complete the captcha",
    "checking your browser",
    "unusual traffic from your computer",
    "access denied",
    "sign in to continue",
    "log in to continue",
]

CLOSED_TEXT = [
    "job is no longer available",
    "position is no longer available",
    "no longer accepting applications",
    "this job has expired",
    "job posting has expired",
]

SUCCESS_TEXT = [
    "thank you for applying",
    "thanks for applying",
    "application received",
    "application submitted",
    "application has been submitted",
    "successfully applied",
    "we have received your application",
    "your application was sent",
]

FIELD_ALIASES: list[tuple[str, list[str]]] = [
    ("firstName", ["first name", "firstname", "given name", "given-name", "fname", "first_name"]),
    ("lastName", ["last name", "lastname", "surname", "family name", "lname", "last_name"]),
    ("fullName", ["full name", "your name", "legal name", "candidate name"]),
    ("email", ["email", "e-mail", "email address"]),
    ("phone", ["phone", "mobile", "telephone", "contact number", "phone number"]),
    ("city", ["city", "current location", "current city", "town", "location"]),
    ("country", ["country", "country of residence"]),
    ("linkedin", ["linkedin"]),
    ("github", ["github"]),
    ("website", ["portfolio", "website", "personal site", "personal website", "blog"]),
    ("university", ["university", "college", "institution", "school"]),
    ("degree", ["degree", "qualification", "highest education"]),
    ("graduationYear", ["graduation year", "year of graduation", "passing year", "year of passing"]),
]

CONSENT_WORDS = ["privacy", "terms", "consent", "data processing", "gdpr", "i agree", "acknowledge"]


@dataclass
class Outcome:
    status: str
    message: str
    confirmation: str | None = None
    final_url: str | None = None
    fields_filled: list[str] = field(default_factory=list)
    screenshot_path: str | None = None


def _text_of(description: dict[str, Any]) -> str:
    parts = [
        description.get("name", ""), description.get("id", ""),
        description.get("placeholder", ""), description.get("aria", ""),
        description.get("label", ""), description.get("parent", ""),
    ]
    return " ".join(str(part) for part in parts if part).lower()


def _matches(text: str, aliases: list[str]) -> bool:
    return any(alias in text for alias in aliases)


def detect_ats(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if "greenhouse.io" in host:
        return "greenhouse"
    if "lever.co" in host:
        return "lever"
    if "ashbyhq.com" in host:
        return "ashby"
    if "smartrecruiters.com" in host:
        return "smartrecruiters"
    if "workday" in host or "myworkdayjobs" in host:
        return "workday"
    if "icims.com" in host:
        return "icims"
    if "taleo.net" in host:
        return "taleo"
    if "successfactors" in host:
        return "successfactors"
    return "generic"


async def _describe(element: Any) -> dict[str, Any]:
    try:
        return await element.evaluate(
            """(el) => {
                const labels = el.labels && el.labels.length ? el.labels[0].innerText : '';
                const parent = el.closest('label, .field, .form-group, [class*="question"], [class*="field"], fieldset');
                return {
                    tag: (el.tagName || '').toLowerCase(),
                    type: (el.getAttribute('type') || '').toLowerCase(),
                    name: el.getAttribute('name') || '',
                    id: el.id || '',
                    placeholder: el.getAttribute('placeholder') || '',
                    aria: el.getAttribute('aria-label') || '',
                    label: labels || '',
                    parent: parent ? (parent.innerText || '').slice(0, 400) : '',
                    required: Boolean(el.required) || el.getAttribute('aria-required') === 'true',
                };
            }"""
        )
    except Exception:
        return {}


async def _body_text(page: Page) -> str:
    try:
        return (await page.inner_text("body")).lower()
    except Exception:
        return ""


async def _detect_blocker(page: Page) -> tuple[str, str] | None:
    url = page.url.lower()
    host = (urlparse(url).hostname or "").lower()
    text = await _body_text(page)

    for pattern in CLOSED_TEXT:
        if pattern in text:
            return ("failed", "The employer's page says this job is closed or no longer accepting applications.")

    if host in LOGIN_HOSTS or "login" in url or "signin" in url:
        return ("manual_required", "This application requires an employer account sign-in. Open the official page and complete it manually.")

    try:
        if await page.locator('input[type="password"]:visible').count() > 0:
            return ("manual_required", "This application requires an account login or password. JobPilot never handles employer passwords.")
    except Exception:
        pass

    for selector in CAPTCHA_SELECTORS:
        try:
            if await page.locator(selector).count() > 0:
                return ("manual_required", "A CAPTCHA is present. Complete it yourself on the official page; JobPilot never bypasses CAPTCHAs.")
        except Exception:
            pass

    for pattern in BLOCKER_TEXT:
        if pattern in text:
            return ("manual_required", f"The employer's page needs human verification ({pattern}). Complete it manually on the official page.")

    return None


async def _open_application(page: Page) -> Page:
    """Click the public Apply link when the URL is a job description page."""
    try:
        if await page.locator('input[type="file"]').count() > 0 or await page.locator('input[type="email"]:visible').count() > 0:
            return page
    except Exception:
        pass

    candidates = [
        'a:has-text("Apply for this job")',
        'button:has-text("Apply for this job")',
        'a:has-text("Apply now")',
        'button:has-text("Apply now")',
        'a:has-text("I am interested")',
        'button:has-text("I am interested")',
        'a:has-text("I\'m interested")',
        'button:has-text("I\'m interested")',
        'a:has-text("Apply")',
        'button:has-text("Apply")',
    ]

    for selector in candidates:
        try:
            locator = page.locator(selector)
            count = await locator.count()
        except Exception:
            continue
        for index in range(min(count, 8)):
            item = locator.nth(index)
            try:
                if not await item.is_visible():
                    continue
                text = ((await item.inner_text()) or "").lower()
                if any(word in text for word in ["linkedin", "indeed", "google", "easy apply", "save", "draft"]):
                    continue
                pages_before = len(page.context.pages)
                await item.click(timeout=ACTION_TIMEOUT_MS)
                await page.wait_for_timeout(1500)
                if len(page.context.pages) > pages_before:
                    page = page.context.pages[-1]
                    try:
                        await page.wait_for_load_state("domcontentloaded", timeout=NAV_TIMEOUT_MS)
                    except PlaywrightTimeoutError:
                        pass
                return page
            except Exception:
                continue
    return page


async def _fill_fields(page: Page, values: dict[str, str], answers: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    filled: list[str] = []
    used_names: set[str] = set()

    try:
        elements = await page.locator("input:visible, textarea:visible").all()
    except Exception:
        elements = []

    for element in elements:
        description = await _describe(element)
        if not description:
            continue
        field_type = str(description.get("type", ""))
        if field_type in {"file", "hidden", "submit", "button", "checkbox", "radio", "password"}:
            continue
        text = _text_of(description)
        if any(word in text for word in ["search", "captcha", "password"]):
            continue
        name = str(description.get("name") or description.get("id") or "")
        if name and name in used_names:
            continue

        value: str | None = None
        label = ""
        for key, aliases in FIELD_ALIASES:
            if _matches(text, aliases) and values.get(key):
                value = values[key]
                label = key
                break

        if value is None and (str(description.get("name", "")).lower() == "name" or text.strip() == "name"):
            value = values.get("fullName")
            label = "fullName"

        if value is None:
            value = _answer_for(text, answers)
            if value is not None:
                label = "custom answer"

        if value is None:
            continue

        try:
            if description.get("tag") == "select":
                if not await _select_matching(element, value):
                    continue
            else:
                await element.fill(str(value), timeout=ACTION_TIMEOUT_MS)
            filled.append(label or name or "field")
            if name:
                used_names.add(name)
        except Exception:
            continue

    missing: list[str] = []
    try:
        required = await page.locator("[required]:visible").all()
    except Exception:
        required = []
    for element in required:
        description = await _describe(element)
        field_type = str(description.get("type", ""))
        if field_type in {"file", "checkbox", "radio"}:
            continue
        try:
            current = (await element.input_value()).strip()
            if not current:
                missing.append(str(description.get("label") or description.get("name") or "required question")[:120])
        except Exception:
            continue

    return filled, missing


def _answer_for(text: str, answers: list[dict[str, Any]]) -> str | None:
    for answer in answers:
        if answer.get("sensitive"):
            continue
        question = str(answer.get("question", "")).lower()
        value = str(answer.get("answer", "")).strip()
        if not value:
            continue
        tokens = {token for token in re.findall(r"[a-z]{4,}", question) if token not in {"what", "your", "with", "this", "that", "have", "from", "will", "please", "describe"}}
        if len(tokens) >= 2 and len(tokens & set(re.findall(r"[a-z]{4,}", text))) >= 2:
            return value
        if len(question) >= 12 and question[:40] in text:
            return value
    return None


async def _select_matching(element: Any, value: str) -> bool:
    try:
        options = await element.locator("option").all_text_contents()
    except Exception:
        return False
    needle = value.lower().strip()
    for option in options:
        haystack = option.lower().strip()
        if not haystack:
            continue
        if needle == haystack or needle in haystack or haystack in needle:
            try:
                await element.select_option(label=option)
                return True
            except Exception:
                continue
    try:
        await element.select_option(value=value)
        return True
    except Exception:
        return False


async def _upload_documents(page: Page, resume_path: str | None, cover_path: str | None) -> bool:
    try:
        inputs = await page.locator('input[type="file"]').all()
    except Exception:
        inputs = []
    if not inputs:
        return False

    resume_used = False
    cover_used = False
    for element in inputs:
        description = await _describe(element)
        text = _text_of(description)
        try:
            if "cover" in text and cover_path and not cover_used:
                await element.set_input_files(cover_path)
                cover_used = True
            elif resume_path and not resume_used:
                await element.set_input_files(resume_path)
                resume_used = True
            elif resume_path:
                await element.set_input_files(resume_path)
                resume_used = True
        except Exception:
            continue
    return resume_used


async def _check_consents(page: Page) -> None:
    try:
        checkboxes = await page.locator('input[type="checkbox"]:visible').all()
    except Exception:
        return
    for checkbox in checkboxes:
        description = await _describe(checkbox)
        text = _text_of(description)
        if not _matches(text, CONSENT_WORDS):
            continue
        try:
            if not await checkbox.is_checked():
                await checkbox.check(timeout=ACTION_TIMEOUT_MS)
        except Exception:
            continue


async def _submit(page: Page) -> tuple[bool, str]:
    candidates = [
        'button[type="submit"]:visible',
        'input[type="submit"]:visible',
        'button:has-text("Submit application"):visible',
        'button:has-text("Submit"):visible',
        'button:has-text("Send application"):visible',
        'button:has-text("Apply"):visible',
    ]
    for selector in candidates:
        try:
            locator = page.locator(selector)
            count = await locator.count()
        except Exception:
            continue
        for index in range(min(count, 6)):
            item = locator.nth(index)
            try:
                if not await item.is_visible():
                    continue
                text = ((await item.inner_text()) or "").lower()
                if any(word in text for word in ["save", "draft", "back", "cancel", "linkedin", "google", "indeed"]):
                    continue
                await item.click(timeout=ACTION_TIMEOUT_MS)
                await page.wait_for_timeout(3000)
                try:
                    await page.wait_for_load_state("networkidle", timeout=12000)
                except PlaywrightTimeoutError:
                    pass
                return True, text[:120]
            except Exception:
                continue
    return False, ""


async def _capture(page: Page, task_id: str) -> str | None:
    try:
        SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        safe_id = re.sub(r"[^a-zA-Z0-9_-]", "-", task_id)[:80] or "task"
        path = SCREENSHOT_DIR / f"{safe_id}.png"
        await page.screenshot(path=str(path), full_page=True)
        return str(path)
    except Exception:
        return None


def _candidate_values(candidate: dict[str, Any]) -> dict[str, str]:
    full_name = str(candidate.get("fullName") or "").strip()
    parts = [part for part in full_name.split() if part]
    first_name = parts[0] if parts else ""
    last_name = parts[-1] if len(parts) > 1 else ""
    return {
        "firstName": first_name,
        "lastName": last_name,
        "fullName": full_name,
        "email": str(candidate.get("email") or ""),
        "phone": str(candidate.get("phone") or ""),
        "city": str(candidate.get("city") or ""),
        "country": str(candidate.get("country") or "India"),
        "linkedin": str(candidate.get("linkedinUrl") or ""),
        "github": str(candidate.get("githubUrl") or ""),
        "website": str(candidate.get("portfolioUrl") or ""),
        "university": str(candidate.get("university") or ""),
        "degree": str(candidate.get("degree") or ""),
        "graduationYear": str(candidate.get("graduationYear") or ""),
    }


async def _run(task: dict[str, Any], document_paths: dict[str, str], dry_run: bool) -> Outcome:
    job = task.get("job") or {}
    application_url = str(job.get("applicationUrl") or "").strip()
    if not application_url:
        return Outcome("failed", "The application URL is missing.")

    if dry_run:
        return Outcome("manual_required", "Dry run is enabled. The form was not opened or submitted.")

    candidate = _candidate_values(task.get("candidate") or {})
    answers = task.get("answers") or []
    submit = bool(task.get("submit", True))
    task_id = str((task.get("task") or {}).get("id") or "task")
    documents = task.get("documents") or []
    resume_path = next((document_paths.get(str(doc.get("id"))) for doc in documents if doc.get("kind") == "resume"), None)
    cover_path = next((document_paths.get(str(doc.get("id"))) for doc in documents if doc.get("kind") == "cover_letter"), None)

    outcome = Outcome("failed", "Browser automation did not start.")
    page: Page | None = None
    browser: Browser | None = None

    async with async_playwright() as playwright:
        try:
            browser = await playwright.chromium.launch(
                headless=HEADLESS,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            context = await browser.new_context(
                locale="en-IN",
                timezone_id="Asia/Kolkata",
                viewport={"width": 1366, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 JobPilot/1.0"
                ),
            )
            page = await context.new_page()
            page.set_default_timeout(ACTION_TIMEOUT_MS)
            page.set_default_navigation_timeout(NAV_TIMEOUT_MS)

            await page.goto(application_url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
            await page.wait_for_timeout(1500)

            blocker = await _detect_blocker(page)
            if blocker:
                outcome = Outcome(blocker[0], blocker[1], final_url=page.url)
                return outcome

            page = await _open_application(page)
            await page.wait_for_timeout(1000)

            blocker = await _detect_blocker(page)
            if blocker:
                outcome = Outcome(blocker[0], blocker[1], final_url=page.url)
                return outcome

            ats = detect_ats(page.url)
            logger.info("task %s using %s adapter at %s", task_id, ats, page.url)

            if ats in {"workday", "icims", "taleo", "successfactors"}:
                outcome = Outcome(
                    "manual_required",
                    f"{ats} applications require an account and multi-step verification. Complete this one on the official page.",
                    final_url=page.url,
                )
                return outcome

            filled, missing = await _fill_fields(page, candidate, answers)

            has_file_input = False
            try:
                has_file_input = await page.locator('input[type="file"]').count() > 0
            except Exception:
                pass
            if has_file_input and resume_path:
                await _upload_documents(page, resume_path, cover_path)

            if not submit:
                outcome = Outcome(
                    "manual_required",
                    "The form was prepared but automatic submission is disabled. Review and submit it yourself.",
                    final_url=page.url,
                    fields_filled=filled,
                )
                return outcome

            if missing:
                outcome = Outcome(
                    "manual_required",
                    "These required questions still need your answer: " + ", ".join(missing[:8]) + ".",
                    final_url=page.url,
                    fields_filled=filled,
                )
                return outcome

            await _check_consents(page)
            clicked, button_text = await _submit(page)
            if not clicked:
                outcome = Outcome(
                    "manual_required",
                    "JobPilot could not find a safe submit button. Complete the final step on the official page.",
                    final_url=page.url,
                    fields_filled=filled,
                )
                return outcome

            blocker = await _detect_blocker(page)
            if blocker:
                outcome = Outcome(blocker[0], f"After submitting: {blocker[1]}", final_url=page.url, fields_filled=filled)
                return outcome

            body = await _body_text(page)
            confirmation = next((pattern for pattern in SUCCESS_TEXT if pattern in body), None)
            if confirmation:
                outcome = Outcome(
                    "applied",
                    f"Submitted with the {ats} adapter. The page confirmed: “{confirmation}”.",
                    confirmation=confirmation,
                    final_url=page.url,
                    fields_filled=filled,
                )
                return outcome

            outcome = Outcome(
                "manual_required",
                f"Clicked “{button_text}” but could not verify a confirmation page. Check your email and confirm manually if the employer received it.",
                final_url=page.url,
                fields_filled=filled,
            )
            return outcome
        except PlaywrightTimeoutError as error:
            outcome = Outcome("failed", f"The employer's page timed out: {str(error)[:300]}", final_url=page.url if page else None)
            return outcome
        except Exception as error:  # noqa: BLE001 - report every worker failure truthfully
            logger.exception("task %s failed", task_id)
            outcome = Outcome("failed", f"Browser automation failed: {str(error)[:500]}", final_url=page.url if page else None)
            return outcome
        finally:
            if page is not None and outcome.status != "applied":
                screenshot = await _capture(page, task_id)
                if screenshot:
                    outcome.screenshot_path = screenshot
                    outcome.message = f"{outcome.message} Screenshot: {screenshot}"
            if browser is not None:
                await browser.close()


async def run_application(task: dict[str, Any], document_paths: dict[str, str], dry_run: bool = False) -> Outcome:
    return await _run(task, document_paths, dry_run)
