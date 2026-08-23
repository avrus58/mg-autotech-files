from __future__ import annotations

import sys
import tempfile
import time
import unittest
from pathlib import Path


ANALYZER_ROOT = Path(__file__).resolve().parents[1]
if str(ANALYZER_ROOT) not in sys.path:
    sys.path.insert(0, str(ANALYZER_ROOT))

from execution import (  # noqa: E402
    AnalyzerExecutionFailure,
    AnalyzerExecutionTimeout,
    analyzer_lock_path,
    run_in_terminated_process,
    try_acquire_analyzer_lease,
)


def return_payload(value: str) -> dict[str, str]:
    return {"value": value}


def sleep_then_return(delay_seconds: float) -> dict[str, bool]:
    time.sleep(delay_seconds)
    return {"completed": True}


def fail_worker() -> dict[str, bool]:
    raise RuntimeError("private worker detail")


class AnalyzerExecutionTests(unittest.TestCase):
    def test_worker_returns_picklable_result(self) -> None:
        self.assertEqual(
            run_in_terminated_process(return_payload, ("ok",), 3),
            {"value": "ok"},
        )

    def test_worker_is_terminated_at_hard_deadline(self) -> None:
        started = time.monotonic()
        with self.assertRaises(AnalyzerExecutionTimeout):
            run_in_terminated_process(sleep_then_return, (5,), 0.15)
        self.assertLess(time.monotonic() - started, 2)

    def test_worker_errors_are_generic(self) -> None:
        with self.assertRaises(AnalyzerExecutionFailure) as raised:
            run_in_terminated_process(fail_worker, (), 3)
        self.assertEqual(str(raised.exception), "")

    def test_file_lease_enforces_one_process_wide_slot(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = analyzer_lock_path(str(Path(directory) / "analyzer.lock"))
            first = try_acquire_analyzer_lease(path)
            self.assertIsNotNone(first)
            try:
                self.assertIsNone(try_acquire_analyzer_lease(path))
            finally:
                if first is not None:
                    first.release()
            second = try_acquire_analyzer_lease(path)
            self.assertIsNotNone(second)
            if second is not None:
                second.release()


if __name__ == "__main__":
    unittest.main()
