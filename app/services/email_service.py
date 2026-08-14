from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("email")


class EmailSender:
    """Pluggable email interface. Phase 1 only implements the 'console'
    provider (logs the link instead of sending real email), so onboarding
    isn't blocked while a real provider's credentials aren't finalized.
    Swapping in Resend/SES/Postmark later means implementing send() for a
    new provider — call sites never change.
    """

    async def send(self, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class ConsoleEmailSender(EmailSender):
    async def send(self, to: str, subject: str, body: str) -> None:
        logger.info("email.console_send", to=to, subject=subject, body=body)


def get_email_sender() -> EmailSender:
    if settings.email_sender_provider == "console":
        return ConsoleEmailSender()
    # Later phases: return ResendEmailSender() / SesEmailSender() / etc.
    return ConsoleEmailSender()


async def send_verification_email(to: str, token: str) -> None:
    sender = get_email_sender()
    link = f"https://app.whatsodo.ai/verify-email?token={token}"
    await sender.send(to, "Verify your Whatsodo AI account", f"Verify your email: {link}")


async def send_password_reset_email(to: str, token: str) -> None:
    sender = get_email_sender()
    link = f"https://app.whatsodo.ai/reset-password?token={token}"
    await sender.send(to, "Reset your Whatsodo AI password", f"Reset your password: {link}")


async def send_workspace_invitation_email(to: str, workspace_name: str, token: str) -> None:
    sender = get_email_sender()
    link = f"https://app.whatsodo.ai/accept-invitation?token={token}"
    await sender.send(to, f"You've been invited to {workspace_name} on Whatsodo AI", f"Accept your invite: {link}")
