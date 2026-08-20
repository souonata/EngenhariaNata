"""Generate a Pintor scrypt password hash without placing the password in shell history."""

import getpass

from ..accounts import hash_password


def main() -> None:
    password = getpass.getpass("Password (minimum 4 characters): ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("passwords do not match")
    print(hash_password(password))


if __name__ == "__main__":
    main()
