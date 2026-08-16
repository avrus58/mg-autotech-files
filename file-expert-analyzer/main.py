from __future__ import annotations

import asyncio
import hashlib
import hmac
import ipaddress
import math
import os
import socket
from pathlib import Path
from typing import Any, Literal
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.types import ASGIApp, Message, Receive, Scope, Send


app = FastAPI(
    title="MG AutoTech File Expert Analyzer",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

HARD_MAX_SOURCE_BYTES = 32 * 1024 * 1024
MAX_ANALYZE_BODY_BYTES = 64 * 1024


class AnalyzerConfigurationError(Exception):
    pass


class SourceValidationError(Exception):
    pass


def bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, min(value, maximum))


def analyzer_token() -> str:
    token = os.getenv("FILE_EXPERT_ANALYZER_TOKEN", "").strip()
    if len(token) < 32:
        raise AnalyzerConfigurationError()
    return token


class AnalyzerRequestGuard:
    """Authenticate and size-limit /analyze before FastAPI buffers its JSON body."""

    def __init__(self, app: ASGIApp):
        # Starlette constructs middleware with the wrapped application as the
        # named `app` argument.
        self.inner = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") != "/analyze":
            await self.inner(scope, receive, send)
            return

        try:
            expected = analyzer_token()
            expected_bytes = expected.encode("ascii")
        except UnicodeEncodeError:
            await JSONResponse(
                {"error": "Analyzer service is not configured."}, status_code=503
            )(scope, receive, send)
            return
        except AnalyzerConfigurationError:
            await JSONResponse(
                {"error": "Analyzer service is not configured."}, status_code=503
            )(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        authorization = headers.get(b"authorization", b"")
        scheme, separator, supplied = authorization.partition(b" ")
        if (
            not separator
            or scheme.lower() != b"bearer"
            or not hmac.compare_digest(supplied.strip(), expected_bytes)
        ):
            await JSONResponse({"error": "Unauthorized."}, status_code=401)(
                scope, receive, send
            )
            return

        raw_length = headers.get(b"content-length", b"")
        if not raw_length.isdigit():
            await JSONResponse(
                {"error": "A bounded request body is required."}, status_code=411
            )(scope, receive, send)
            return
        if int(raw_length) > MAX_ANALYZE_BODY_BYTES:
            await JSONResponse({"error": "Analyzer request is too large."}, status_code=413)(
                scope, receive, send
            )
            return

        consumed = 0

        async def limited_receive() -> Message:
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > MAX_ANALYZE_BODY_BYTES:
                    raise SourceValidationError()
            return message

        try:
            await self.inner(scope, limited_receive, send)
        except SourceValidationError:
            await JSONResponse({"error": "Analyzer request is too large."}, status_code=413)(
                scope, receive, send
            )


app.add_middleware(AnalyzerRequestGuard)
analysis_slots = asyncio.Semaphore(
    bounded_int("FILE_EXPERT_ANALYZER_MAX_CONCURRENT", 1, 1, 1)
)

ECU_IDENTIFIERS = [
    "Bosch",
    "Siemens",
    "Continental",
    "Delphi",
    "Denso",
    "Marelli",
    "Delco",
    "EDC",
    "MED",
    "MEVD",
    "MD1",
    "MG1",
    "EDC15",
    "EDC16",
    "EDC17",
    "MED17",
    "MEVD17",
    "MS43",
    "MS45",
    "EGS",
    "ZF",
    "6HP",
    "8HP",
    "CRD",
    "SID",
    "PCR",
    "Simos",
    "E80",
    "E39",
    "E39A",
    "MEDC17",
    "TC179",
    "TC176",
    "TC275",
]


class AnalyzerMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    brand: str | None = Field(default=None, max_length=120)
    model: str | None = Field(default=None, max_length=160)
    engine: str | None = Field(default=None, max_length=220)
    ecu_type: str | None = Field(default=None, max_length=200)
    read_method: str | None = Field(default=None, max_length=120)
    ori_file_name: str | None = Field(default=None, max_length=255)
    mod_file_name: str | None = Field(default=None, max_length=255)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(min_length=1, max_length=128)
    ori_file_path: str | None = Field(default=None, max_length=4096)
    mod_file_path: str | None = Field(default=None, max_length=4096)
    ori_file_url: str | None = Field(default=None, max_length=4096)
    mod_file_url: str | None = Field(default=None, max_length=4096)
    metadata: AnalyzerMetadata = Field(default_factory=AnalyzerMetadata)


def hex_offset(offset: int) -> str:
    return f"0x{offset:06X}"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ratio_of(data: bytes, byte: int) -> float:
    if not data:
        return 0
    return round(data.count(byte) / len(data), 4)


def entropy(data: bytes) -> float:
    if not data:
        return 0
    counts = [0] * 256
    for value in data:
        counts[value] += 1
    total = 0.0
    for count in counts:
        if count:
            probability = count / len(data)
            total -= probability * math.log2(probability)
    return round(total, 3)


def ascii_strings(data: bytes, limit: int = 60) -> list[str]:
    strings: list[str] = []
    current: list[int] = []
    for value in data:
        if 32 <= value <= 126:
            if len(current) < 512:
                current.append(value)
            continue
        if len(current) >= 4:
            strings.append(bytes(current).decode("ascii", errors="ignore"))
        current = []
        if len(strings) >= limit:
            break
    if len(current) >= 4 and len(strings) < limit:
        strings.append(bytes(current).decode("ascii", errors="ignore"))
    unique = []
    for item in strings:
        if item not in unique and any(ch.isalnum() for ch in item):
            unique.append(item)
    return unique[:limit]


def inspect_file(data: bytes) -> dict[str, Any]:
    strings = ascii_strings(data)
    joined = " ".join(strings).lower()
    return {
        "file_size": len(data),
        "sha256": sha256(data),
        "first_64_bytes_hex": data[:64].hex(),
        "last_64_bytes_hex": data[-64:].hex() if data else "",
        "ff_ratio": ratio_of(data, 0xFF),
        "zero_ratio": ratio_of(data, 0x00),
        "entropy": entropy(data),
        "ascii_strings": strings,
        "ecu_identifiers": [item for item in ECU_IDENTIFIERS if item.lower() in joined],
    }


def active_regions(data: bytes, block_size: int = 4096) -> list[dict[str, Any]]:
    regions: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for offset in range(0, len(data), block_size):
        block = data[offset : offset + block_size]
        active = sum(1 for value in block if value not in (0x00, 0xFF))
        density = active / len(block) if block else 0
        if density > 0.18:
            if current is None:
                current = {"start": offset, "end": offset + len(block), "density_sum": density, "blocks": 1}
            else:
                current["end"] = offset + len(block)
                current["density_sum"] += density
                current["blocks"] += 1
        elif current is not None:
            regions.append({
                "start_offset_hex": hex_offset(current["start"]),
                "end_offset_hex": hex_offset(current["end"]),
                "density": round(current["density_sum"] / current["blocks"], 3),
            })
            current = None
    if current is not None:
        regions.append({
            "start_offset_hex": hex_offset(current["start"]),
            "end_offset_hex": hex_offset(current["end"]),
            "density": round(current["density_sum"] / current["blocks"], 3),
        })
    return regions[:80]


def changed_block(ori: bytes, mod: bytes, start: int, end: int) -> dict[str, Any]:
    ori_preview = ori[start : min(end, start + 24)]
    mod_preview = mod[start : min(end, start + 24)]
    deltas = []
    changed = 0
    for index in range(start, end):
        if ori[index] != mod[index]:
            changed += 1
            if len(deltas) < 12:
                deltas.append(mod[index] - ori[index])
    signed = [value - 256 if value > 127 else value for value in mod_preview[:12]]
    return {
        "start_offset_hex": hex_offset(start),
        "end_offset_hex": hex_offset(end),
        "length": end - start,
        "changed_byte_count": changed,
        "ori_hex_preview": ori_preview.hex(),
        "mod_hex_preview": mod_preview.hex(),
        "unsigned_8bit_preview": list(mod_preview[:12]),
        "signed_8bit_preview": signed,
        "uint16_be_preview": [int.from_bytes(mod_preview[i : i + 2], "big") for i in range(0, min(len(mod_preview) - 1, 16), 2)],
        "uint16_le_preview": [int.from_bytes(mod_preview[i : i + 2], "little") for i in range(0, min(len(mod_preview) - 1, 16), 2)],
        "delta_preview": deltas,
    }


def compare_files(ori: bytes, mod: bytes) -> dict[str, Any]:
    comparable_length = min(len(ori), len(mod))
    merged: list[tuple[int, int]] = []
    changed_bytes = abs(len(ori) - len(mod))
    current_start: int | None = None
    merged_start: int | None = None
    merged_end = 0
    raw_range_count = 0
    merged_range_count = 0

    def flush_merged() -> None:
        nonlocal merged_start, merged_range_count
        if merged_start is None:
            return
        merged_range_count += 1
        if len(merged) < 120:
            merged.append((merged_start, merged_end))
        merged_start = None

    def consume_raw(start: int, end: int) -> None:
        nonlocal raw_range_count, merged_start, merged_end
        raw_range_count += 1
        if merged_start is not None and start - merged_end <= 32:
            merged_end = end
            return
        flush_merged()
        merged_start = start
        merged_end = end

    for index in range(comparable_length):
        if ori[index] != mod[index]:
            changed_bytes += 1
            if current_start is None:
                current_start = index
        elif current_start is not None:
            consume_raw(current_start, index)
            current_start = None
    if current_start is not None:
        consume_raw(current_start, comparable_length)
    flush_merged()

    return {
        "same_size": len(ori) == len(mod),
        "changed_bytes": changed_bytes,
        "changed_percent": round(changed_bytes / max(len(ori), len(mod), 1) * 100, 5),
        "raw_changed_blocks": raw_range_count,
        "merged_changed_blocks": merged_range_count,
        "changed_blocks": [changed_block(ori, mod, start, end) for start, end in merged],
    }


def map_candidates(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates = []
    for block in blocks:
        if block["length"] < 16 or block["changed_byte_count"] < 8:
            continue
        confidence = min(0.85, 0.38 + block["length"] / 600)
        candidates.append({
            "offset_hex": block["start_offset_hex"],
            "length": block["length"],
            "possible_type": "map_candidate",
            "reason": "Structured changed region with repeated numeric deltas.",
            "confidence": round(confidence, 2),
        })
    return candidates[:40]


def repeated_patterns(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[str]] = {}
    for block in blocks:
        signature = f"{min(block['length'], 128)}:{','.join(map(str, block['delta_preview'][:4]))}"
        groups.setdefault(signature, []).append(block["start_offset_hex"])
    return [
        {"signature": signature, "count": len(offsets), "offsets": offsets, "reason": "Similar changed block signature repeated."}
        for signature, offsets in list(groups.items())[:30]
        if len(offsets) >= 2
    ]


def feature_heuristics(mode: Literal["single_file", "ori_mod_compare"], comparison: dict[str, Any] | None, maps: list[dict[str, Any]], identifiers: list[str]) -> dict[str, Any]:
    warnings = [
        "Checksum must be verified before writing.",
        "Human tuner confirmation is required before any flashing decision.",
    ]
    if mode == "single_file" or not comparison:
        return {
            "features": [],
            "risk_level": "unknown",
            "confidence": 0.42,
            "stock": "unknown",
            "reasons": ["Single file analysis cannot confirm exact modifications."],
            "warnings": warnings,
            "conclusion": "A single file was inspected. No ORI/MOD comparison was available.",
        }
    features = []
    changed_percent = comparison["changed_percent"]
    block_count = comparison["merged_changed_blocks"]
    map_count = len(maps)
    if changed_percent > 0.005 and map_count >= 5:
        features.append({"feature": "stage1", "confidence": min(0.88, 0.58 + map_count / 60), "reasons": ["Multiple structured calibration-like regions changed."]})
    if changed_percent > 0.08 and map_count >= 12:
        features.append({"feature": "stage2", "confidence": 0.55, "reasons": ["Higher modification density with many map-like changes."]})
    if block_count > 60 and changed_percent < 0.2:
        features.append({"feature": "dtc_off", "confidence": 0.45, "reasons": ["Many small changed blocks can match diagnostic table edits."]})
    if block_count <= 12 and changed_percent < 0.03:
        features.append({"feature": "vmax_off", "confidence": 0.38, "reasons": ["Limited isolated changes can match limiter or flag edits."]})
    if any(item in {"EGS", "ZF", "6HP", "8HP"} for item in identifiers) and map_count >= 3:
        features.append({"feature": "tcu_tune", "confidence": 0.58, "reasons": ["TCU identifiers and repeated map-like changes detected."]})
    if not features and changed_percent > 0:
        features.append({"feature": "stock_or_modified", "confidence": 0.68, "reasons": ["Files differ but feature pattern is not specific enough."]})
    return {
        "features": features,
        "risk_level": "high" if changed_percent > 0.5 else "medium" if changed_percent > 0.04 else "unknown",
        "confidence": min(0.88, 0.45 + len(features) * 0.08 + map_count / 100),
        "stock": "likely_modified" if changed_percent > 0 else "likely_stock",
        "reasons": [f"{changed_percent}% of bytes changed across {block_count} merged regions."],
        "warnings": warnings,
        "conclusion": "The MOD file differs from the ORI in structured file regions. Feature labels are heuristic and require human confirmation.",
    }


def allowed_source_hosts() -> set[str]:
    return {
        item.strip().lower().rstrip(".")
        for item in os.getenv("FILE_EXPERT_ANALYZER_ALLOWED_HOSTS", "").split(",")
        if item.strip()
    }


async def require_public_dns(hostname: str, port: int) -> None:
    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo,
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except OSError as error:
        raise SourceValidationError() from error
    resolved = {item[4][0].split("%", 1)[0] for item in addresses}
    if not resolved:
        raise SourceValidationError()
    try:
        if any(not ipaddress.ip_address(address).is_global for address in resolved):
            raise SourceValidationError()
    except ValueError as error:
        raise SourceValidationError() from error


def validate_remote_url(value: str) -> tuple[str, int]:
    try:
        parsed = urlsplit(value)
        port = parsed.port or 443
    except ValueError as error:
        raise SourceValidationError() from error
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if (
        parsed.scheme != "https"
        or not hostname
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or port != 443
    ):
        raise SourceValidationError()
    hosts = allowed_source_hosts()
    if not hosts:
        raise AnalyzerConfigurationError()
    if hostname not in hosts:
        raise SourceValidationError()
    return hostname, port


def read_local_source(value: str, maximum_bytes: int) -> bytes:
    configured_root = os.getenv("FILE_EXPERT_ANALYZER_LOCAL_ROOT", "").strip()
    if not configured_root:
        raise SourceValidationError()
    try:
        root = Path(configured_root).resolve(strict=True)
        if root.parent == root:
            raise AnalyzerConfigurationError()
        source = Path(value).resolve(strict=True)
        source.relative_to(root)
    except AnalyzerConfigurationError:
        raise
    except (OSError, RuntimeError, ValueError) as error:
        raise SourceValidationError() from error
    if not source.is_file():
        raise SourceValidationError()
    with source.open("rb") as handle:
        data = handle.read(maximum_bytes + 1)
    if not data or len(data) > maximum_bytes:
        raise SourceValidationError()
    return data


async def download_remote_source(
    value: str,
    maximum_bytes: int,
    timeout_seconds: int,
) -> bytes:
    hostname, port = validate_remote_url(value)
    await require_public_dns(hostname, port)
    timeout = httpx.Timeout(timeout_seconds, connect=min(timeout_seconds, 10))
    content = bytearray()
    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=False,
        trust_env=False,
    ) as client:
        async with client.stream("GET", value) as response:
            if 300 <= response.status_code < 400:
                raise SourceValidationError()
            try:
                response.raise_for_status()
            except httpx.HTTPError as error:
                raise SourceValidationError() from error
            raw_length = response.headers.get("content-length")
            if raw_length:
                try:
                    if int(raw_length) <= 0 or int(raw_length) > maximum_bytes:
                        raise SourceValidationError()
                except ValueError as error:
                    raise SourceValidationError() from error
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > maximum_bytes:
                    raise SourceValidationError()
    if not content:
        raise SourceValidationError()
    return bytes(content)


async def load_source(
    path: str | None,
    url: str | None,
    timeout_seconds: int,
) -> bytes | None:
    if path and url:
        raise SourceValidationError()
    maximum_bytes = bounded_int(
        "FILE_EXPERT_ANALYZER_MAX_SOURCE_BYTES",
        HARD_MAX_SOURCE_BYTES,
        1024,
        HARD_MAX_SOURCE_BYTES,
    )
    if url:
        return await download_remote_source(url, maximum_bytes, timeout_seconds)
    if path:
        return await asyncio.to_thread(read_local_source, path, maximum_bytes)
    return None


async def load_sources(request: AnalyzeRequest) -> tuple[bytes | None, bytes | None]:
    """Load an ORI/MOD pair concurrently under one wall-clock deadline."""
    timeout_seconds = bounded_int("FILE_EXPERT_ANALYZER_TIMEOUT_SECONDS", 20, 3, 30)
    tasks = [
        asyncio.create_task(
            load_source(request.ori_file_path, request.ori_file_url, timeout_seconds)
        ),
        asyncio.create_task(
            load_source(request.mod_file_path, request.mod_file_url, timeout_seconds)
        ),
    ]
    try:
        ori, mod = await asyncio.wait_for(
            asyncio.gather(*tasks),
            timeout=timeout_seconds,
        )
        return ori, mod
    except asyncio.TimeoutError as error:
        raise SourceValidationError() from error
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


@app.exception_handler(RequestValidationError)
async def invalid_request_handler(_request: Any, _error: RequestValidationError) -> JSONResponse:
    return JSONResponse({"error": "Invalid analyzer request."}, status_code=422)


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Any, _error: Exception) -> JSONResponse:
    return JSONResponse({"error": "Analyzer request failed."}, status_code=500)


@app.get("/health")
def health() -> dict[str, str]:
    try:
        analyzer_token().encode("ascii")
    except (AnalyzerConfigurationError, UnicodeEncodeError) as error:
        raise HTTPException(status_code=503, detail="Analyzer service is not configured.") from error
    if not allowed_source_hosts():
        raise HTTPException(status_code=503, detail="Analyzer service is not configured.")
    return {"status": "ok"}


def build_analysis_result(
    job_id: str,
    ori: bytes | None,
    mod: bytes | None,
) -> dict[str, Any]:
    """Run CPU-bound binary inspection outside the ASGI event-loop thread."""
    mode: Literal["single_file", "ori_mod_compare"] = "ori_mod_compare" if ori and mod else "single_file"
    files: dict[str, Any] = {}
    if ori:
        files["ori"] = inspect_file(ori)
    if mod:
        files["mod"] = inspect_file(mod)
    if mode == "single_file":
        files["single"] = inspect_file(mod or ori or b"")

    comparison = compare_files(ori, mod) if ori and mod else None
    maps = map_candidates(comparison["changed_blocks"] if comparison else [])
    repeats = repeated_patterns(comparison["changed_blocks"] if comparison else [])
    identifiers = list({identifier for file_data in files.values() for identifier in file_data.get("ecu_identifiers", [])})
    heuristic = feature_heuristics(mode, comparison, maps, identifiers)
    base_file = mod or ori or b""

    return {
        "job_id": job_id,
        "analysis_version": "2.0.0",
        "mode": mode,
        "files": files,
        "comparison": comparison,
        "active_regions": active_regions(base_file),
        "map_candidates": maps,
        "repeated_patterns": repeats,
        "possible_features": heuristic["features"],
        "risk_assessment": {
            "risk_level": heuristic["risk_level"],
            "confidence": round(heuristic["confidence"], 2),
            "reasons": heuristic["reasons"],
            "warnings": heuristic["warnings"],
        },
        "summary": {
            "stock_or_modified": heuristic["stock"],
            "main_conclusion": heuristic["conclusion"],
            "recommended_next_steps": [
                "Review detected regions in professional calibration software.",
                "Verify checksum before writing.",
                "Confirm results with logs and experienced tuner review.",
            ],
        },
    }


@app.post("/analyze")
async def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    try:
        await asyncio.wait_for(analysis_slots.acquire(), timeout=0.25)
    except asyncio.TimeoutError as error:
        raise HTTPException(status_code=429, detail="Analyzer is busy.") from error

    try:
        try:
            ori, mod = await load_sources(request)
        except AnalyzerConfigurationError as error:
            raise HTTPException(status_code=503, detail="Analyzer service is not configured.") from error
        except (SourceValidationError, httpx.HTTPError) as error:
            raise HTTPException(status_code=400, detail="A file source could not be read safely.") from error
        if not ori and not mod:
            raise HTTPException(status_code=400, detail="No readable file source was provided.")

        analysis_task = asyncio.create_task(
            asyncio.to_thread(build_analysis_result, request.job_id, ori, mod)
        )
        try:
            return await asyncio.shield(analysis_task)
        except asyncio.CancelledError:
            # A disconnected caller must not release the concurrency slot while
            # its non-cancellable worker thread is still consuming CPU.
            await analysis_task
            raise
    finally:
        analysis_slots.release()
