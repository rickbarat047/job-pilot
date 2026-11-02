# Automation Policy

## Default level

Level 3: prepare applications and submit only after explicit approval.

## Never automated

- Accepting offers or signing contracts.
- Payments.
- Sensitive demographic disclosures.
- Legally binding declarations.
- Inventing answers to screening questions.

## Permission levels

1. Discovery only.
2. Discovery + preparation.
3. Prepare + submit after approval.
4. Rule-based auto-apply for pre-approved categories above a score threshold.

## Failure handling

- Failed tasks are retried with exponential backoff.
- Failed applications are marked `Application Failed`, never `Applied`.
- CAPTCHAs, MFA, login walls and unsupported forms pause automation and notify the user.
- Duplicate applications are blocked unless explicitly allowed.
