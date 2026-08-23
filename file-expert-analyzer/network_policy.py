from __future__ import annotations

import ipaddress


def is_public_unicast_address(value: str) -> bool:
    """Accept globally routable unicast source addresses only."""

    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return (
        address.is_global
        and not address.is_multicast
        and not address.is_reserved
        and not address.is_unspecified
    )
