class EncryptionService:
    async def encrypt(self, plaintext: str) -> str:
        return f"placeholder:{len(plaintext)}"

    async def decrypt(self, ciphertext: str) -> str:
        _ = ciphertext
        raise NotImplementedError("Encryption provider is not configured yet.")

