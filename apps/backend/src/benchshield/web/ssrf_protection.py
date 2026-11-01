"""SSRF protection and URL validation for controlled web fetching.

Strictly protects against:
- Loopback addresses (127.0.0.0/8, ::1, localhost)
- RFC 1918 private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Link-local and cloud metadata services (169.254.0.0/16, 169.254.169.254, metadata.google.internal)
- IPv6 private/unique local and link-local ranges (fc00::/7, fe80::/10)
- Multicast, broadcast, reserved, and unspecified addresses
- Non-HTTP/HTTPS schemes (e.g. file://, gopher://, ftp://)
"""

import ipaddress
import socket
import urllib.parse

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),  # Carrier-grade NAT
    ipaddress.ip_network("127.0.0.0/8"),  # IPv4 Loopback
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local / AWS / GCP / Azure metadata
    ipaddress.ip_network("172.16.0.0/12"),  # Private RFC 1918
    ipaddress.ip_network("192.168.0.0/16"),  # Private RFC 1918
    ipaddress.ip_network("198.18.0.0/15"),  # Benchmark testing
    ipaddress.ip_network("224.0.0.0/4"),  # Multicast
    ipaddress.ip_network("240.0.0.0/4"),  # Reserved
    ipaddress.ip_network("255.255.255.255/32"),
    # IPv6 Networks
    ipaddress.ip_network("::/128"),  # Unspecified
    ipaddress.ip_network("::1/128"),  # Loopback
    ipaddress.ip_network("fc00::/7"),  # Unique local
    ipaddress.ip_network("fe80::/10"),  # Link-local
    ipaddress.ip_network("ff00::/8"),  # Multicast
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "instance-data",
    "169.254.169.254",
}


class SSRFViolationError(Exception):
    """Raised when an outbound URL violates SSRF safety boundaries."""

    def __init__(self, message: str, url: str | None = None):
        super().__init__(message)
        self.url = url


def is_ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Check if an IP address belongs to any blocked or private subnet."""
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True

    return any(ip in net for net in BLOCKED_IP_NETWORKS)


def validate_url_safe_for_fetch(url: str) -> str:
    """Validate that a URL is safe to retrieve externally.

    Returns the normalized URL if safe, or raises SSRFViolationError if unsafe.
    """
    if not url or not isinstance(url, str):
        raise SSRFViolationError("URL must be a non-empty string.", url=url)

    url_clean = url.strip()
    parsed = urllib.parse.urlsplit(url_clean)

    # 1. Scheme check: only http and https allowed
    if parsed.scheme.lower() not in ("http", "https"):
        raise SSRFViolationError(
            f"Prohibited scheme '{parsed.scheme}'. Only http and https are permitted.",
            url=url,
        )

    # 2. Hostname extraction
    hostname = parsed.hostname
    if not hostname:
        raise SSRFViolationError("URL must include a valid hostname.", url=url)

    hostname_lower = hostname.lower()

    # 3. Known dangerous hostnames
    if hostname_lower in BLOCKED_HOSTNAMES or hostname_lower.endswith(".internal"):
        raise SSRFViolationError(
            f"Prohibited hostname '{hostname}' violates internal network isolation.",
            url=url,
        )

    # 4. Direct IP address check (e.g. http://127.0.0.1 or http://[::1])
    try:
        ip = ipaddress.ip_address(hostname_lower)
        if is_ip_blocked(ip):
            raise SSRFViolationError(
                f"Prohibited target IP address '{ip}' resolves to a restricted/private network.",
                url=url,
            )
        return url_clean
    except ValueError:
        # Not a direct IP, proceed to DNS resolution
        pass

    # 5. DNS Resolution check to prevent DNS rebinding or hostname-hidden private IPs
    try:
        addr_infos = socket.getaddrinfo(
            hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            proto=socket.IPPROTO_TCP,
        )
        for _family, _, _, _, sockaddr in addr_infos:
            resolved_ip_str = sockaddr[0]
            resolved_ip = ipaddress.ip_address(resolved_ip_str)
            if is_ip_blocked(resolved_ip):
                raise SSRFViolationError(
                    f"Hostname '{hostname}' resolves to restricted IP '{resolved_ip}'.",
                    url=url,
                )
    except socket.gaierror as err:
        # If DNS cannot resolve in a strictly disconnected or offline test, allow or raise depending on scenario
        # But in a live fetch, DNS failure means host cannot be reached safely.
        raise SSRFViolationError(
            f"Failed to resolve hostname '{hostname}': {err}",
            url=url,
        ) from err

    return url_clean
