"""Account persistence, password hashing, normalization, and session tests."""

import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from wirecolor.accounts import (
    AccountError, AccountStore, AccountSuspended, DuplicateUsername, InvalidCredentials,
    LastAdministrator, hash_password, verify_password,
)


class AccountStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "accounts.sqlite3"
        self.store = AccountStore(self.database, session_days=30)

    def tearDown(self):
        self.temp.cleanup()

    def test_password_requires_four_characters_without_composition_rules(self):
        with self.assertRaises(AccountError):
            self.store.register("tester", "123")
        account = self.store.register("tester", "    ")
        self.assertEqual(account["username"], "tester")
        self.assertEqual(self.store.authenticate("tester", "    ")["id"], account["id"])

    def test_password_hash_is_salted_and_never_contains_plaintext(self):
        first = hash_password("four-word-test")
        second = hash_password("four-word-test")
        self.assertNotEqual(first, second)
        self.assertNotIn("four-word-test", first)
        self.assertTrue(verify_password("four-word-test", first))
        self.assertFalse(verify_password("wrong-password", first))

    def test_username_must_exist_and_is_unique_after_nfkc_casefold(self):
        for invalid in ("", "   ", "bad\x00name"):
            with self.subTest(invalid=repr(invalid)), self.assertRaises(AccountError):
                self.store.register(invalid, "1234")
        self.store.register("  Tést  ", "1234")
        with self.assertRaises(DuplicateUsername):
            self.store.register("TE\u0301ST", "abcd")

    def test_login_failure_is_generic(self):
        self.store.register("real-user", "1234")
        for username, password in (("missing", "1234"), ("real-user", "wrong")):
            with self.subTest(username=username), self.assertRaisesRegex(
                InvalidCredentials, "invalid username or password",
            ):
                self.store.authenticate(username, password)

    def test_session_token_is_hashed_expires_and_can_be_revoked(self):
        account = self.store.register("session-user", "1234")
        token, expires = self.store.create_session(account["id"], now=100)
        with closing(sqlite3.connect(self.database)) as connection:
            stored = connection.execute(
                "SELECT token_hash FROM account_sessions",
            ).fetchone()[0]
        self.assertNotEqual(stored, token)
        self.assertEqual(self.store.current(token, now=expires - 1)["id"], account["id"])
        self.assertIsNone(self.store.current(token, now=expires))
        token, _ = self.store.create_session(account["id"])
        self.store.revoke(token)
        self.assertIsNone(self.store.current(token))

    def test_admin_bootstrap_uses_hash_and_does_not_promote_existing_user(self):
        credential = hash_password("admin-pass")
        admin = self.store.bootstrap_admin("operator", credential)
        self.assertEqual(admin["role"], "admin")
        self.assertEqual(self.store.authenticate("operator", "admin-pass")["role"], "admin")
        self.assertEqual(self.store.bootstrap_admin("OPERATOR", credential)["id"], admin["id"])
        self.store.register("reserved", "1234")
        with self.assertRaises(DuplicateUsername):
            self.store.bootstrap_admin("RESERVED", credential)

    def test_suspension_blocks_login_and_kills_live_sessions(self):
        account = self.store.register("tester", "1234")
        token, _ = self.store.create_session(account["id"])
        self.assertIsNotNone(self.store.current(token))
        suspended = self.store.set_status(account["id"], "suspended")
        self.assertEqual(suspended["status"], "suspended")
        self.assertIsNone(self.store.current(token))
        with self.assertRaises(AccountSuspended):
            self.store.authenticate("tester", "1234")
        self.store.set_status(account["id"], "active")
        self.assertEqual(self.store.authenticate("tester", "1234")["status"], "active")

    def test_role_change_revokes_sessions_so_powers_never_travel_on_an_old_cookie(self):
        account = self.store.register("promoted", "1234")
        token, _ = self.store.create_session(account["id"])
        self.assertEqual(self.store.set_role(account["id"], "admin")["role"], "admin")
        self.assertIsNone(self.store.current(token))

    def test_the_last_active_administrator_cannot_be_suspended_demoted_or_deleted(self):
        admin = self.store.bootstrap_admin("operator", hash_password("admin-pass"))
        self.store.register("plain", "1234")
        for action in (
            lambda: self.store.set_status(admin["id"], "suspended"),
            lambda: self.store.set_role(admin["id"], "user"),
            lambda: self.store.delete_account(admin["id"]),
        ):
            with self.assertRaises(LastAdministrator):
                action()
        second = self.store.register("second-admin", "1234", role="admin")
        self.assertEqual(self.store.delete_account(admin["id"])["id"], admin["id"])
        self.assertEqual(self.store.count_admins(), 1)
        self.assertEqual(second["role"], "admin")

    def test_bootstrap_reactivates_the_configured_administrator(self):
        credential = hash_password("admin-pass")
        admin = self.store.bootstrap_admin("operator", credential)
        self.store.register("second-admin", "1234", role="admin")
        self.store.set_status(admin["id"], "suspended")
        restored = self.store.bootstrap_admin("operator", credential)
        self.assertEqual(restored["status"], "active")
        self.assertEqual(restored["id"], admin["id"])

    def test_database_created_before_suspension_gains_the_column_with_everyone_active(self):
        legacy = Path(self.temp.name) / "legacy.sqlite3"
        with closing(sqlite3.connect(legacy)) as connection:
            connection.executescript("""
                CREATE TABLE accounts (
                    id TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    username_key TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    last_login_at INTEGER
                );
            """)
            connection.execute(
                "INSERT INTO accounts VALUES (?, ?, ?, ?, 'user', 1, 1, NULL)",
                ("abc", "old-tester", "old-tester", hash_password("1234")),
            )
            connection.commit()
        store = AccountStore(legacy)
        self.assertEqual(store.authenticate("old-tester", "1234")["status"], "active")
        self.assertEqual(store.list_accounts()[0]["username"], "old-tester")


if __name__ == "__main__":
    unittest.main()
