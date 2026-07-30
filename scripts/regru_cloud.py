#!/usr/bin/env python3
import argparse
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_BASE = "https://api.cloudvps.reg.ru"
DEFAULT_ENV_FILE = ".env.deploy"


def main():
    parser = argparse.ArgumentParser(description="Reg.ru CloudVPS helper.")
    parser.add_argument("--env-file", default=DEFAULT_ENV_FILE)

    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list-servers")
    subparsers.add_parser("list-plans")
    subparsers.add_parser("list-images")
    subparsers.add_parser("list-v1-sizes")
    subparsers.add_parser("list-v1-images")
    subparsers.add_parser("list-keys")
    subparsers.add_parser("balance")

    add_key_parser = subparsers.add_parser("add-key")
    add_key_parser.add_argument("--name", default="mycloud-deploy")
    add_key_parser.add_argument("--public-key-file", required=True)

    create_parser = subparsers.add_parser("create-server")
    create_parser.add_argument("--name")
    create_parser.add_argument("--size")
    create_parser.add_argument("--image")
    create_parser.add_argument("--ssh-key")
    create_parser.add_argument("--backups", action="store_true")
    create_parser.add_argument("--wait", action="store_true")

    args = parser.parse_args()
    load_env_file(Path(args.env_file))

    if args.command == "list-servers":
        print_json(api_request("GET", "/v1/reglets"))
        return

    if args.command == "list-plans":
        region = require_env("REG_RU_REGION")
        data = api_request(
            "GET",
            "/v2/plans",
            query={
                "region": region,
                "page": os.getenv("REG_RU_PAGE", "1"),
                "items_per_page": os.getenv("REG_RU_ITEMS_PER_PAGE", "100"),
                "unit": os.getenv("REG_RU_UNIT", "hour"),
            },
        )
        print_table(
            data.get("plans", []),
            ["slug", "name", "vcpus", "memory", "disk", "price_per_month"],
        )
        return

    if args.command == "list-images":
        region = require_env("REG_RU_REGION")
        data = api_request(
            "GET",
            "/v2/images",
            query={
                "region": region,
                "page": os.getenv("REG_RU_PAGE", "1"),
                "items_per_page": os.getenv("REG_RU_ITEMS_PER_PAGE", "100"),
                "type": os.getenv("REG_RU_IMAGE_TYPE", "distribution"),
            },
        )
        print_table(
            data.get("images", []),
            ["slug", "name", "distribution", "type", "min_disk_size"],
        )
        return

    if args.command == "list-v1-sizes":
        data = api_request("GET", "/v1/sizes")
        print_table(
            data.get("sizes", []),
            ["slug", "name", "vcpus", "memory", "disk", "price_month"],
        )
        return

    if args.command == "list-v1-images":
        data = api_request("GET", "/v1/images")
        print_table(
            data.get("images", []),
            ["slug", "name", "distribution", "type", "min_disk_size"],
        )
        return

    if args.command == "list-keys":
        print_json(api_request("GET", "/v1/account/keys"))
        return

    if args.command == "balance":
        print_json(api_request("GET", "/v1/balance_data"))
        return

    if args.command == "add-key":
        public_key = Path(args.public_key_file).read_text(encoding="utf-8").strip()
        data = api_request(
            "POST",
            "/v1/account/keys",
            payload={
                "name": args.name,
                "public_key": public_key,
            },
        )
        print_json(data)
        return

    if args.command == "create-server":
        name = args.name or require_env("REG_RU_SERVER_NAME")
        size = args.size or require_env("REG_RU_SIZE")
        image = args.image or require_env("REG_RU_IMAGE")
        ssh_key = args.ssh_key or require_env("REG_RU_SSH_KEY")
        payload = {
            "name": name,
            "region_slug": os.getenv("REG_RU_REGION", "msk1"),
            "size": size,
            "image": image,
            "ssh_keys": [ssh_key],
        }
        if args.backups:
            payload["backups"] = True
        data = api_request("POST", "/v1/reglets", payload=payload)
        print_json(data)

        if args.wait:
            wait_for_server(name)
        return


def load_env_file(path):
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_env(name):
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Set {name} in {DEFAULT_ENV_FILE} or environment.")
    return value


def api_request(method, path, query=None, payload=None):
    token = require_env("REG_RU_CLOUD_TOKEN")
    url = f"{API_BASE}{path}"
    if query:
        url = f"{url}?{urlencode(query)}"

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Reg.ru API error {error.code}: {body}") from error


def wait_for_server(name):
    for _ in range(60):
        data = api_request("GET", "/v1/reglets")
        servers = data.get("reglets", [])
        server = next((item for item in servers if item.get("name") == name), None)
        if server:
            status = server.get("status")
            ip = server.get("ip")
            print(f"{name}: status={status}, ip={ip}")
            if status == "active" and ip:
                return
        time.sleep(10)

    raise SystemExit("Server was not active after waiting.")


def print_json(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))


def print_table(items, columns):
    for item in items:
        print(" | ".join(str(item.get(column, "")) for column in columns))


if __name__ == "__main__":
    main()
