from __future__ import annotations

import hashlib
import math
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(title="MG AutoTech File Expert Analyzer", version="1.0.0")

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


class AnalyzeRequest(BaseModel):
    job_id: str
    ori_file_path: str | None = None
    mod_file_path: str | None = None
    ori_file_url: str | None = None
    mod_file_url: str | None = None
    metadata: dict[str, Any] = {}


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
    raw_ranges: list[tuple[int, int]] = []
    changed_bytes = abs(len(ori) - len(mod))
    current_start: int | None = None
    for index in range(comparable_length):
        if ori[index] != mod[index]:
            changed_bytes += 1
            if current_start is None:
                current_start = index
        elif current_start is not None:
            raw_ranges.append((current_start, index))
            current_start = None
    if current_start is not None:
        raw_ranges.append((current_start, comparable_length))

    merged: list[tuple[int, int]] = []
    for start, end in raw_ranges:
        if merged and start - merged[-1][1] <= 32:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))

    return {
        "same_size": len(ori) == len(mod),
        "changed_bytes": changed_bytes,
        "changed_percent": round(changed_bytes / max(len(ori), len(mod), 1) * 100, 5),
        "raw_changed_blocks": len(raw_ranges),
        "merged_changed_blocks": len(merged),
        "changed_blocks": [changed_block(ori, mod, start, end) for start, end in merged[:120]],
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


async def load_source(path: str | None, url: str | None) -> bytes | None:
    if url:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.content
    if path:
        local_path = Path(path)
        if local_path.exists() and local_path.is_file():
            return local_path.read_bytes()
    return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    ori = await load_source(request.ori_file_path, request.ori_file_url)
    mod = await load_source(request.mod_file_path, request.mod_file_url)
    if not ori and not mod:
        raise HTTPException(status_code=400, detail="No readable ORI or MOD file source was provided.")

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
        "job_id": request.job_id,
        "analysis_version": "1.0.0",
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
