# Handover Checklist

Audience: owner and receiving team  
Last verified version: `0.1.1` / commit `8842877`

## Access

- [ ] Repository access confirmed
- [ ] Branch protection confirmed
- [ ] Vercel access confirmed
- [ ] Render access confirmed
- [ ] Upstash access confirmed
- [ ] Blob/storage access confirmed
- [ ] Domain/DNS access confirmed
- [ ] Backup storage access confirmed
- [ ] Secret ownership assigned
- [ ] Billing owner assigned

## Technical State

- [x] Current package version recorded: `0.1.1`
- [x] Current commit recorded: `8842877`
- [x] Main scripts documented
- [x] Environment variables documented without values
- [x] PostgreSQL schema documented
- [x] Backup scripts documented
- [x] Performance scripts documented
- [ ] Restore drill completed
- [ ] Staging environment verified
- [ ] CI workflow created

## Verification

- [x] Typecheck passed during handover
- [x] Lint passed during handover
- [x] Unit tests passed during handover
- [x] Backup safety tests passed during handover
- [x] Production build passed during handover
- [x] Bundle budget passed during handover
- [!] Secret scan run; bootstrap password string requires owner/security review
- [ ] Browser screenshot regression completed
- [ ] Production smoke test completed by owner/operator

## Acceptance

- [ ] Owner reviews known limitations
- [ ] Owner approves RPO/RTO
- [ ] Owner provisions restore-test infrastructure
- [ ] Owner assigns operational responsibilities
- [ ] Owner approves final production release
