"""
Guards for server-side downloads.

The import flows fetch URLs the browser hands us (a PDF link, a Google
Scholar export). Left unchecked that is a request-forgery hole: a link
to http://localhost:8000/... or a cloud metadata address would be fetched
from inside the machine. These helpers only allow http(s) URLs whose host
resolves to public addresses, and re-check every redirect hop.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Callable
from urllib.parse import urljoin, urlsplit

import requests

MAX_REDIRECTS = 5
_REDIRECT_STATUS = {301, 302, 303, 307, 308}


class UnsafeUrlError(ValueError):
    """The URL points somewhere the server must not fetch from."""


def assert_public_http_url(url: str) -> None:
    """Raise UnsafeUrlError unless `url` is http(s) to a public host."""

    parts = urlsplit((url or "").strip())

    if parts.scheme not in ("http", "https"):
        raise UnsafeUrlError("Only http and https links can be downloaded.")

    host = parts.hostname

    if not host:
        raise UnsafeUrlError("That link has no host name.")

    if parts.username or parts.password:
        raise UnsafeUrlError("Links with credentials are not allowed.")

    try:
        infos = socket.getaddrinfo(host, parts.port or None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"Could not resolve {host}.") from exc

    for info in infos:
        address = ipaddress.ip_address(info[4][0].split("%")[0])

        if not address.is_global:
            raise UnsafeUrlError("That link points to a private or local address.")


def safe_get(
    url: str,
    *,
    host_ok: Callable[[str], bool] | None = None,
    **kwargs,
) -> requests.Response:
    """
    `requests.get` with the redirects followed by hand, so every hop is
    checked: http(s) only, a public host, and (when given) `host_ok(url)`.
    """

    current = url

    for _ in range(MAX_REDIRECTS + 1):
        assert_public_http_url(current)

        if host_ok is not None and not host_ok(current):
            raise UnsafeUrlError("That link redirects somewhere that is not allowed.")

        response = requests.get(current, allow_redirects=False, **kwargs)

        if getattr(response, "status_code", None) in _REDIRECT_STATUS:
            location = response.headers.get("Location")

            if not location:
                return response

            response.close()
            current = urljoin(current, location)
            continue

        return response

    raise UnsafeUrlError("That link redirects too many times.")
