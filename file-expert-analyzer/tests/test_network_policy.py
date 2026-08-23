from __future__ import annotations

import sys
import unittest
from pathlib import Path


ANALYZER_ROOT = Path(__file__).resolve().parents[1]
if str(ANALYZER_ROOT) not in sys.path:
    sys.path.insert(0, str(ANALYZER_ROOT))

from network_policy import is_public_unicast_address  # noqa: E402


class AnalyzerNetworkPolicyTests(unittest.TestCase):
    def test_global_unicast_addresses_are_accepted(self) -> None:
        self.assertTrue(is_public_unicast_address("8.8.8.8"))
        self.assertTrue(is_public_unicast_address("2606:4700:4700::1111"))

    def test_multicast_reserved_unspecified_and_non_public_addresses_are_rejected(self) -> None:
        for value in (
            "224.0.0.1",
            "ff02::1",
            "240.0.0.1",
            "0.0.0.0",
            "::",
            "127.0.0.1",
            "10.0.0.1",
            "169.254.169.254",
            "fe80::1",
            "not-an-ip",
        ):
            with self.subTest(value=value):
                self.assertFalse(is_public_unicast_address(value))


if __name__ == "__main__":
    unittest.main()
