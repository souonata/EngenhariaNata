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
    AccountError, AccountStore, DuplicateUsername, InvalidCredentials, hash_password,
    verify_password,
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


if __name__ == "__main__":
    unittest.main()
