from __future__ import annotations

import multiprocessing
import os
import tempfile
from pathlib import Path
from types import TracebackType
from typing import Any, Callable


class AnalyzerExecutionConfigurationError(Exception):
    pass


class AnalyzerExecutionTimeout(Exception):
    pass


class AnalyzerExecutionFailure(Exception):
    pass


class AnalyzerFileLease:
    def __init__(self, handle: Any):
        self._handle = handle

    def release(self) -> None:
        if self._handle is None:
            return
        handle = self._handle
        self._handle = None
        try:
            if os.name == "nt":
                import msvcrt

                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        finally:
            handle.close()

    def __enter__(self) -> "AnalyzerFileLease":
        return self

    def __exit__(
        self,
        _exception_type: type[BaseException] | None,
        _exception: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        self.release()


def analyzer_lock_path(value: str | None) -> Path:
    default_path = Path(tempfile.gettempdir()) / "mg-autotech-file-expert.lock"
    raw = (value or str(default_path)).strip()
    path = Path(raw)
    if not path.is_absolute() or not path.name or path.parent == path:
        raise AnalyzerExecutionConfigurationError()
    if not path.parent.is_dir():
        raise AnalyzerExecutionConfigurationError()
    return path


def try_acquire_analyzer_lease(path: Path) -> AnalyzerFileLease | None:
    try:
        handle = path.open("a+b")
    except OSError as error:
        raise AnalyzerExecutionConfigurationError() from error

    try:
        if os.name == "nt":
            import msvcrt

            if path.stat().st_size == 0:
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            try:
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                handle.close()
                return None
        else:
            import fcntl

            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                handle.close()
                return None
    except Exception:
        if not handle.closed:
            handle.close()
        raise

    return AnalyzerFileLease(handle)


def _analysis_process_entry(
    sender: Any,
    target: Callable[..., dict[str, Any]],
    arguments: tuple[Any, ...],
) -> None:
    try:
        sender.send(("ok", target(*arguments)))
    except BaseException:
        # Worker internals and customer-derived values never cross the process
        # boundary in an error response.
        try:
            sender.send(("error", None))
        except (BrokenPipeError, EOFError, OSError):
            pass
    finally:
        sender.close()


def _terminate_process(process: multiprocessing.Process) -> None:
    if not process.is_alive():
        process.join(timeout=0.2)
        return
    process.terminate()
    process.join(timeout=0.75)
    if process.is_alive():
        process.kill()
        process.join(timeout=0.75)


def run_in_terminated_process(
    target: Callable[..., dict[str, Any]],
    arguments: tuple[Any, ...],
    timeout_seconds: float,
) -> dict[str, Any]:
    """Run one analysis in a spawn process and kill it at the wall deadline."""

    if timeout_seconds <= 0:
        raise AnalyzerExecutionTimeout()

    context = multiprocessing.get_context("spawn")
    receiver, sender = context.Pipe(duplex=False)
    process = context.Process(
        target=_analysis_process_entry,
        args=(sender, target, arguments),
        daemon=True,
        name="mg-file-expert-analysis",
    )
    started = False

    try:
        process.start()
        started = True
        sender.close()
        if not receiver.poll(timeout_seconds):
            _terminate_process(process)
            raise AnalyzerExecutionTimeout()

        try:
            status, payload = receiver.recv()
        except (EOFError, OSError) as error:
            raise AnalyzerExecutionFailure() from error

        process.join(timeout=0.25)
        if process.is_alive():
            _terminate_process(process)
        if status != "ok" or not isinstance(payload, dict):
            raise AnalyzerExecutionFailure()
        return payload
    finally:
        receiver.close()
        if not sender.closed:
            sender.close()
        if started:
            _terminate_process(process)
