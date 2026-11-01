"""Application-layer authenticated encryption for the protected gold vault.

Threat Model & Boundary:
- Protects vaulted reference answers against database compromise, backup theft, and storage leakages.
- Uses AES-256-GCM (Galois/Counter Mode) authenticated encryption.
- Encryption keys are supplied via environment/secret managers and NEVER stored in the database or source code.
- Each encrypted record stores a unique 12-byte random nonce and a key version identifier.
- Key rotation: Re-encrypting records with a new key version can be performed incrementally without downtime.

What application encryption DOES address:
- Direct database file exfiltration, unauthorized volume snapshots, and SQL dump leaks.
- Read access by database operators who lack application encryption keys.

What application encryption DOES NOT address:
- Memory inspection of the application runtime holding the key in RAM.
- Compromise of the trusted verifier runtime that legitimately decrypts answers for grading.
"""

import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_gold_answer(
    plaintext: str,
    key_hex: str,
    key_version: str = "v1",
) -> tuple[bytes, bytes, str]:
    """Encrypt a protected gold answer string using AES-256-GCM.

    Returns:
        (ciphertext, nonce, key_version)
    """
    key_bytes = bytes.fromhex(key_hex)
    aesgcm = AESGCM(key_bytes)
    # Generate 12-byte random nonce (standard for GCM)
    nonce = os.urandom(12)
    # Associated data binds key_version to prevent version substitution attacks
    associated_data = key_version.encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data)
    return ciphertext, nonce, key_version


def decrypt_gold_answer(
    ciphertext: bytes,
    nonce: bytes,
    key_hex: str,
    key_version: str = "v1",
) -> str:
    """Decrypt a protected gold answer ciphertext using AES-256-GCM.

    Raises:
        cryptography.exceptions.InvalidTag if ciphertext or nonce has been tampered with.
    """
    key_bytes = bytes.fromhex(key_hex)
    aesgcm = AESGCM(key_bytes)
    associated_data = key_version.encode("utf-8")
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, associated_data)
    return decrypted_bytes.decode("utf-8")
