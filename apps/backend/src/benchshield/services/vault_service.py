"""Trusted gold vault retrieval service restricted to authorized verifier credentials."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from benchshield.config import Settings, get_settings
from benchshield.persistence.models import ProtectedAnswerModel
from benchshield.storage.vault_encryption import decrypt_gold_answer


class TrustedVaultReader:
    """Restricted reader for evaluating candidate answers against protected references.

    STRICT BOUNDARY:
    Only instantiated with dedicated verifier credentials.
    General API repositories, investigators, and attackers have NO access to this reader.
    """

    def __init__(self, verifier_session: AsyncSession, settings: Settings | None = None):
        self.session = verifier_session
        self.settings = settings or get_settings()

    async def get_protected_answer(
        self,
        answer_revision_id: str,
        workspace_id: str,
    ) -> tuple[str, str | None]:
        """Fetch and decrypt reference answer.

        Returns:
            (gold_answer_text, gold_choice_id)
        """
        stmt = select(ProtectedAnswerModel).where(
            ProtectedAnswerModel.id == answer_revision_id,
            ProtectedAnswerModel.workspace_id == workspace_id,
        )
        record = (await self.session.execute(stmt)).scalar_one_or_none()
        if record is None:
            raise ValueError(
                f"Protected answer revision '{answer_revision_id}' not found in workspace '{workspace_id}'."
            )

        decrypted_text = decrypt_gold_answer(
            ciphertext=record.encrypted_answer,
            nonce=record.nonce,
            key_hex=self.settings.vault_encryption_key,
            key_version=record.key_version,
        )
        return decrypted_text, record.gold_choice_id
