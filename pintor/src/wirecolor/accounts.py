"""Persistent beta accounts and opaque server-side sessions.

The public beta code controls who may reach account endpoints. Accounts then provide stable job
ownership across devices. Passwords are never stored directly: every credential uses a unique
salt and Python's memory-hard scrypt implementation.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
import time
import unicodedata
import uuid
from contextlib import contextmanager
from pathlib import Path


ACCOUNT_COOKIE = "pintor_account"
MIN_PASSWORD_LENGTH = 4
MAX_PASSWORD_LENGTH = 128
MAX_USERNAME_LENGTH = 64
ACCOUNT_STATUSES = ("active", "suspended")
SESSION_RE = __import__("re").compile(r"^[a-f0-9]{64}$")
SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32


class AccountError(ValueError):
    """Base class for account validation and authentication failures."""


class DuplicateUsername(AccountError):
    """Raised when a normalized username is already registered."""


class InvalidCredentials(AccountError):
    """Raised for the deliberately generic login failure."""


class AccountSuspended(AccountError):
    """Raised when valid credentials belong to an account an administrator suspended."""


class LastAdministrator(AccountError):
    """Raised when an operation would leave the beta without any administrator."""


def normalize_username(username: str) -> tuple[str, str]:
    """Return the display username and its canonical uniqueness key."""
    if not isinstance(username, str):
        raise AccountError("username is required")
    display = unicodedata.normalize("NFKC", username.strip())
    if not 1 <= len(display) <= MAX_USERNAME_LENGTH:
        raise AccountError(f"username must contain between 1 and {MAX_USERNAME_LENGTH} characters")
    if any(unicodedata.category(character).startswith("C") for character in display):
        raise AccountError("username cannot contain control characters")
    return display, display.casefold()


def validate_password(password: str) -> str:
    if not isinstance(password, str):
        raise AccountError("password is required")
    if not MIN_PASSWORD_LENGTH <= len(password) <= MAX_PASSWORD_LENGTH:
        raise AccountError(
            f"password must contain between {MIN_PASSWORD_LENGTH} and {MAX_PASSWORD_LENGTH} characters"
        )
    return password


def hash_password(password: str) -> str:
    """Encode a salted scrypt credential suitable for persistent storage."""
    encoded = validate_password(password).encode("utf-8")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        encoded, salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_DKLEN,
    )
    return ":".join((
        "scrypt", str(SCRYPT_N), str(SCRYPT_R), str(SCRYPT_P),
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    ))


def verify_password(password: str, encoded_hash: str) -> bool:
    """Verify a credential without exposing parser errors or timing-safe comparison details."""
    try:
        algorithm, n, r, p, salt_text, digest_text = encoded_hash.split(":", 5)
        if algorithm != "scrypt":
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_text.encode("ascii"))
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p),
            dklen=len(expected),
        )
    except (AttributeError, TypeError, ValueError):
        return False
    return hmac.compare_digest(actual, expected)


def _session_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


class AccountStore:
    """SQLite account store designed for the single API service in the private beta."""

    def __init__(self, database: str | Path, session_days: int = 30):
        self.database = Path(database).resolve()
        self.database.parent.mkdir(parents=True, exist_ok=True)
        self.session_seconds = max(1, session_days) * 24 * 3600
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 15000")
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._connection() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS accounts (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    username_key TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
                    status TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended')),
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    last_login_at INTEGER,
                    previous_login_at INTEGER
                );
                CREATE TABLE IF NOT EXISTS account_sessions (
                    token_hash TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS account_sessions_expiry
                    ON account_sessions(expires_at);
            """)
            columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(accounts)")
            }
            if "status" not in columns:
                # Beta databases created before suspension existed: everyone starts active.
                connection.execute(
                    "ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"
                )
            if "previous_login_at" not in columns:
                # Without a previous visit on record, everything counts as new on the next one.
                connection.execute("ALTER TABLE accounts ADD COLUMN previous_login_at INTEGER")
        try:
            os.chmod(self.database, 0o600)
        except OSError:
            pass

    @staticmethod
    def _public_account(row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "username": row["username"],
            "role": row["role"],
            "status": row["status"] if "status" in row.keys() else "active",
            "created_at": row["created_at"],
            "last_login_at": row["last_login_at"],
            "previous_login_at": (
                row["previous_login_at"] if "previous_login_at" in row.keys() else None
            ),
        }

    def register(self, username: str, password: str, role: str = "user") -> dict:
        display, key = normalize_username(username)
        credential = hash_password(password)
        if role not in {"user", "admin"}:
            raise AccountError("invalid account role")
        now = int(time.time())
        account_id = uuid.uuid4().hex
        try:
            with self._connection() as connection:
                connection.execute(
                    "INSERT INTO accounts (id, username, username_key, password_hash, role, "
                    "created_at, updated_at, last_login_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (account_id, display, key, credential, role, now, now, now),
                )
        except sqlite3.IntegrityError as error:
            raise DuplicateUsername("username is already registered") from error
        # Registration signs the account in straight away, so it counts as the first login.
        return {"id": account_id, "username": display, "role": role, "status": "active",
                "created_at": now, "last_login_at": now, "previous_login_at": None}

    def bootstrap_admin(self, username: str, password_hash: str) -> dict:
        """Create the configured administrator once, without accepting plaintext secrets."""
        display, key = normalize_username(username)
        if not password_hash.startswith("scrypt:"):
            raise AccountError("administrator password must be a Pintor scrypt hash")
        now = int(time.time())
        with self._connection() as connection:
            existing = connection.execute(
                "SELECT * FROM accounts WHERE username_key = ?", (key,),
            ).fetchone()
            if existing:
                if existing["role"] != "admin":
                    raise DuplicateUsername("configured administrator username belongs to a user")
                if existing["status"] != "active":
                    # The configured administrator is the recovery path; suspension never sticks.
                    connection.execute(
                        "UPDATE accounts SET status = 'active', updated_at = ? WHERE id = ?",
                        (now, existing["id"]),
                    )
                    existing = connection.execute(
                        "SELECT * FROM accounts WHERE id = ?", (existing["id"],),
                    ).fetchone()
                return self._public_account(existing)
            account_id = uuid.uuid4().hex
            connection.execute(
                "INSERT INTO accounts "
                "(id, username, username_key, password_hash, role, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, 'admin', ?, ?)",
                (account_id, display, key, password_hash, now, now),
            )
        return {"id": account_id, "username": display, "role": "admin", "status": "active",
                "created_at": now, "last_login_at": None, "previous_login_at": None}

    def authenticate(self, username: str, password: str) -> dict:
        try:
            _, key = normalize_username(username)
        except AccountError:
            key = ""
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM accounts WHERE username_key = ?", (key,),
            ).fetchone()
            # A real scrypt calculation also occurs for unknown users, reducing username probing.
            credential = row["password_hash"] if row else hash_password("invalid-password")
            valid = verify_password(password if isinstance(password, str) else "", credential)
            if not row or not valid:
                raise InvalidCredentials("invalid username or password")
            if row["status"] != "active":
                raise AccountSuspended("this account is suspended")
            now = int(time.time())
            # The visit that is ending becomes the reference for "what happened while I was away".
            previous = row["last_login_at"] or row["created_at"]
            connection.execute(
                "UPDATE accounts SET last_login_at = ?, previous_login_at = ?, updated_at = ? "
                "WHERE id = ?",
                (now, previous, now, row["id"]),
            )
            account = self._public_account(row)
            account["last_login_at"] = now
            account["previous_login_at"] = previous
            return account

    def create_session(self, account_id: str, now: int | None = None) -> tuple[str, int]:
        issued = int(time.time()) if now is None else int(now)
        expires = issued + self.session_seconds
        token = secrets.token_hex(32)
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO account_sessions (token_hash, account_id, created_at, expires_at) "
                "VALUES (?, ?, ?, ?)",
                (_session_hash(token), account_id, issued, expires),
            )
        return token, expires

    def current(self, token: str | None, now: int | None = None) -> dict | None:
        if not token or not SESSION_RE.fullmatch(token):
            return None
        timestamp = int(time.time()) if now is None else int(now)
        token_hash = _session_hash(token)
        with self._connection() as connection:
            connection.execute("DELETE FROM account_sessions WHERE expires_at <= ?", (timestamp,))
            row = connection.execute(
                "SELECT accounts.* FROM account_sessions "
                "JOIN accounts ON accounts.id = account_sessions.account_id "
                "WHERE account_sessions.token_hash = ? AND account_sessions.expires_at > ?",
                (token_hash, timestamp),
            ).fetchone()
        if not row or row["status"] != "active":
            return None
        return self._public_account(row)

    def revoke(self, token: str | None) -> None:
        if not token or not SESSION_RE.fullmatch(token):
            return
        with self._connection() as connection:
            connection.execute(
                "DELETE FROM account_sessions WHERE token_hash = ?", (_session_hash(token),),
            )

    def get(self, account_id: str) -> dict | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT * FROM accounts WHERE id = ?", (account_id,),
            ).fetchone()
        return self._public_account(row) if row else None

    def list_accounts(self) -> list[dict]:
        """Return every account for the administration console, oldest registration first."""
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT * FROM accounts ORDER BY created_at ASC",
            ).fetchall()
        return [self._public_account(row) for row in rows]

    @staticmethod
    def _count_admins(connection, exclude_id: str | None = None) -> int:
        query = "SELECT COUNT(*) FROM accounts WHERE role = 'admin' AND status = 'active'"
        parameters: tuple = ()
        if exclude_id:
            query += " AND id != ?"
            parameters = (exclude_id,)
        return int(connection.execute(query, parameters).fetchone()[0])

    def count_admins(self, exclude_id: str | None = None) -> int:
        with self._connection() as connection:
            return self._count_admins(connection, exclude_id)

    def _require_row(self, connection, account_id: str):
        row = connection.execute(
            "SELECT * FROM accounts WHERE id = ?", (account_id,),
        ).fetchone()
        if not row:
            raise AccountError("account not found")
        return row

    def set_status(self, account_id: str, status: str) -> dict:
        """Suspend or reactivate an account, never removing the last active administrator."""
        if status not in ACCOUNT_STATUSES:
            raise AccountError("invalid account status")
        now = int(time.time())
        with self._connection() as connection:
            row = self._require_row(connection, account_id)
            if status == "suspended" and row["role"] == "admin"                     and self._count_admins(connection, exclude_id=account_id) == 0:
                raise LastAdministrator("the beta must keep one active administrator")
            connection.execute(
                "UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, account_id),
            )
            if status == "suspended":
                connection.execute(
                    "DELETE FROM account_sessions WHERE account_id = ?", (account_id,),
                )
            updated = self._require_row(connection, account_id)
            return self._public_account(updated)

    def set_role(self, account_id: str, role: str) -> dict:
        """Promote or demote an account, never removing the last active administrator."""
        if role not in {"user", "admin"}:
            raise AccountError("invalid account role")
        now = int(time.time())
        with self._connection() as connection:
            row = self._require_row(connection, account_id)
            if role == "user" and row["role"] == "admin"                     and self._count_admins(connection, exclude_id=account_id) == 0:
                raise LastAdministrator("the beta must keep one active administrator")
            connection.execute(
                "UPDATE accounts SET role = ?, updated_at = ? WHERE id = ?",
                (role, now, account_id),
            )
            # A change of powers always restarts from a fresh sign-in.
            connection.execute(
                "DELETE FROM account_sessions WHERE account_id = ?", (account_id,),
            )
            updated = self._require_row(connection, account_id)
            return self._public_account(updated)

    def delete_account(self, account_id: str) -> dict:
        """Remove an account and its sessions; stored jobs are deleted by the caller."""
        with self._connection() as connection:
            row = self._require_row(connection, account_id)
            if row["role"] == "admin"                     and self._count_admins(connection, exclude_id=account_id) == 0:
                raise LastAdministrator("the beta must keep one active administrator")
            account = self._public_account(row)
            connection.execute("DELETE FROM account_sessions WHERE account_id = ?", (account_id,))
            connection.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
        return account

    def revoke_account_sessions(self, account_id: str) -> None:
        with self._connection() as connection:
            connection.execute("DELETE FROM account_sessions WHERE account_id = ?", (account_id,))
