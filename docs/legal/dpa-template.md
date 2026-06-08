# Antarix Data Processing Agreement (DPA) — Template

> **Disclaimer:** This is a template prepared for the Antarix 11/10 platform. It is not legal advice and has not been reviewed by qualified counsel. The European Commission's Standard Contractual Clauses (SCCs) and the UK International Data Transfer Addendum are referenced; the live linked versions in Annex B must be the current official text on the date of signature. Engage a privacy lawyer before relying on this template for production use.

**Effective date:** TBD
**Last updated:** 2026-06-06

This Data Processing Agreement ("DPA") is entered into between:

**(1) Antarix**, the data processor, a company registered in TBD <!-- TODO: insert Antarix legal entity name, jurisdiction, and company number --> ("**Processor**"); and

**(2) {{PARTY_NAME}}**, the data controller, a company registered in {{PARTY_JURISDICTION}} with company number {{PARTY_COMPANY_NUMBER}}, with its principal office at {{PARTY_ADDRESS}} ("**Controller**").

Processor and Controller are each a "Party" and together the "Parties".

This DPA forms part of, and is incorporated by reference into, the Antarix Master Services Agreement (or the Antarix Terms of Service, if no MSA exists) between the Parties (the "Agreement"). Capitalised terms not defined here have the meaning given in the Agreement.

## 1. Definitions

For the purposes of this DPA:

- "**Applicable Data Protection Law**" means all laws applicable to the processing of personal data under this DPA, including (a) Regulation (EU) 2016/679 ("**GDPR**") and the UK GDPR; (b) the Digital Personal Data Protection Act, 2023 (India); (c) the California Consumer Privacy Act, as amended by the CPRA ("**CCPA**"); (d) Brazil's Lei Geral de Proteção de Dados ("**LGPD**"); and (e) the EU AI Act (Regulation 2024/1689) where applicable.
- "**Personal Data**", "**Processing**", "**Controller**", "**Processor**", "**Data Subject**", "**Supervisory Authority**", and "**Sub-processor**" have the meanings given in GDPR Article 4.
- "**Standard Contractual Clauses**" or "**SCCs**" means the standard contractual clauses for the transfer of personal data to third countries pursuant to Regulation (EU) 2016/679, as set out in Commission Implementing Decision (EU) 2021/914 of 4 June 2021, Module Two (controller-to-processor) and Module Three (processor-to-processor) where applicable, as further specified in Annex B.
- "**Sub-processor List**" means the document published by Processor at `docs/legal/sub-processor-list.md`, as updated from time to time in accordance with §9.

## 2. Subject matter, nature, purpose, and duration

**Subject matter.** Processor's processing of Personal Data on behalf of Controller in connection with the Antarix platform services described in the Agreement (the "**Services**").

**Nature of processing.** Storage, hosting, retrieval, analysis, transformation, transmission, and deletion of Personal Data via the Antarix web application, Edge Functions, database, and integrations with the Sub-processors listed in §9.

**Purpose.** The limited purpose of delivering the Services as described in the Agreement, the Antarix [Privacy Notice](privacy-notice.md), and any documented Controller instructions. Processor shall not process Personal Data for any other purpose and shall not sell Personal Data.

**Duration.** For the term of the Agreement and, thereafter, until Processor has deleted or returned all Personal Data in accordance with §13.

## 3. Type of personal data and categories of data subjects

**Type of Personal Data.** The Personal Data processed depends on which Services Controller uses. By default:

- **Account data:** name, email, hashed password (where email sign-up is enabled)
- **GitHub data:** user ID, username, public commit metadata (hash, repository, branch, author, timestamp, file change counts, additions, deletions), repository metadata, pull request metadata; we store no more than the first 200 characters of a commit message and never read code diffs
- **Google Calendar data:** event id, start, end, title, attendee count, RSVP; we do not read event descriptions, attachments, conference links, attendee email addresses, or free-text content
- **Power Mode extension data:** work session records, aggregate window- and tab-focus samples, extension version and heartbeat timestamps
- **Skill Proof outputs:** 0–100 Skill Proof Score, per-skill proficiency, placement prediction (probability, company tier, time-to-ready, gap list)
- **Communications:** WhatsApp phone number, bot message content, web push subscription data, transactional email
- **Usage telemetry:** dashboard visits, feature clicks, device metadata, error and performance events

**Special categories.** None. Processor does not knowingly process special-category data under GDPR Art 9; Controller shall not instruct Processor to do so without prior written agreement.

**Categories of Data Subjects.** Students registered on the Antarix platform; their authorised representatives; and any other individuals whose Personal Data Controller submits to the Services.

## 4. Controller obligations

Controller shall:

- Determine the lawful basis under GDPR Art 6 (and any equivalent under DPDP Act 2023, CCPA, LGPD) for the processing and obtain any required consents
- Provide Processor with accurate documented instructions and notify Processor of any changes
- Respond to Data Subject requests in accordance with Applicable Data Protection Law; Processor shall provide reasonable assistance under §7
- Conduct any required Data Protection Impact Assessments and prior consultations with Supervisory Authorities
- Not instruct Processor to process Personal Data in a manner that violates Applicable Data Protection Law

## 5. Processor obligations

Processor shall:

- Process Personal Data only on documented instructions from Controller, including with regard to transfers, unless required to do otherwise by EU, UK, US, or other applicable law (in which case Processor shall inform Controller of that legal requirement before processing, unless that law prohibits such information on important grounds of public interest)
- Ensure that persons authorised to process Personal Data are committed to confidentiality or are under an appropriate statutory obligation of confidentiality
- Implement appropriate technical and organisational measures as described in Annex A
- Engage Sub-processors only in accordance with §9
- Assist Controller in fulfilling its obligations to respond to Data Subject requests under §7
- On becoming aware of a Personal Data breach, notify Controller without undue delay and in any event within 48 hours, in accordance with §8
- Assist Controller in ensuring compliance with Articles 32–36 of GDPR
- At the choice of Controller, delete or return all Personal Data at the end of the provision of the Services, in accordance with §13
- Make available to Controller all information necessary to demonstrate compliance with this DPA and allow audits in accordance with §11

## 6. Instructions and changes

The Agreement, the Antarix product documentation, and any subsequent documented instruction constitute Controller's complete instructions to Processor. If Processor reasonably believes an instruction infringes Applicable Data Protection Law, Processor shall notify Controller and suspend that instruction. The Parties shall discuss in good faith a compliant alternative. If no agreed alternative is reached within 30 days, Controller may terminate the affected Service on 30 days' notice without liability.

## 7. Data Subject rights assistance

Processor shall, taking into account the nature of the processing:

- Provide Controller with self-service tools (the Antarix "Settings → Privacy" page and the in-app dashboards for college and company users) to action common Data Subject requests (access, rectification, erasure, restriction, portability, objection, withdrawal of consent) on Controller's behalf
- For requests that cannot be self-served, respond to Controller's request for assistance within 10 business days
- Where technically feasible, transmit Personal Data to Controller or directly to a Data Subject in a structured, machine-readable format

## 8. Personal data breach

Processor shall notify Controller of a Personal Data breach affecting Controller's Personal Data without undue delay and in any event within 48 hours of becoming aware. The notification shall include, to the extent then known:

- The nature of the breach, including the categories and approximate number of Data Subjects and records affected
- The name and contact details of Processor's privacy contact (`privacy@antarix.app`)
- The likely consequences of the breach
- The measures taken or proposed to address the breach and mitigate its adverse effects

Processor shall reasonably cooperate with Controller in fulfilling Controller's notification obligations to Supervisory Authorities, Data Subjects, the Data Protection Board of India (within 72 hours where applicable), and other regulators.

## 9. Sub-processors

Controller authorises Processor to engage the Sub-processors listed in the [Sub-processor List](sub-processor-list.md). Processor shall:

- Engage Sub-processors only by way of a written contract that imposes data-protection obligations no less protective than this DPA
- Maintain an up-to-date Sub-processor List on the Antarix documentation site
- Notify Controller at least 30 days in advance of any intended addition or replacement of a Sub-processor (via email to the address Controller has provided), giving Controller the opportunity to object on reasonable grounds related to data protection
- If Controller objects and Processor cannot accommodate the objection, Controller may terminate the affected Service on 30 days' notice

## 10. International data transfers

Transfers of Personal Data outside the European Economic Area, the United Kingdom, or Switzerland (as applicable) shall be governed by one of the following lawful transfer mechanisms:

- **Adequacy decision.** A transfer to a country or territory recognised as adequate by the European Commission, the UK Secretary of State, or the Swiss Federal Data Protection and Information Commissioner, as applicable
- **EU–US Data Privacy Framework.** For transfers to US recipients certified under the EU–US DPF (and the UK Extension and Swiss–US DPF as applicable)
- **Standard Contractual Clauses.** The SCCs are incorporated by reference into this DPA. Module Two (controller-to-processor) applies where Controller is a controller. Module Three (processor-to-processor) applies where Controller is a processor and onward transfer to a Sub-processor is involved. The data-export particulars are set out in Annex B
- **UK International Data Transfer Addendum.** For restricted transfers from the United Kingdom
- **Other lawful mechanism.** Any other lawful mechanism recognised under Applicable Data Protection Law

For transfers out of India, Processor shall transfer only to recipients in jurisdictions not on the negative list issued under Section 16(2) of the DPDP Act 2023. <!-- TODO: re-check the negative list on the date of signature. -->

## 11. Audit rights

Processor shall make available to Controller, on reasonable request, the information necessary to demonstrate compliance with this DPA. Controller may, at its own cost, audit Processor's compliance with this DPA once per calendar year on 30 days' written notice, subject to:

- The audit being conducted during normal business hours and in a manner that does not unreasonably disrupt Processor's operations
- The auditor (Controller's own staff or an independent auditor bound by confidentiality) signing Processor's standard NDA
- The scope being limited to the systems, processes, and records reasonably necessary to verify compliance with this DPA

Processor may satisfy the audit obligation by providing a current SOC 2 Type II report (or equivalent independent assurance report) prepared by a reputable third-party auditor covering the systems and processes used to deliver the Services.

## 12. Security measures

Processor shall implement and maintain the technical and organisational measures described in Annex A and [docs/architecture.md](../architecture.md). These include encryption in transit (TLS 1.2+) and at rest, role-based access control, least-privilege service-role keys, audit logging of administrative actions, secure development practices, and incident response runbooks.

## 13. Termination and return or deletion of data

On termination of the Services for any reason:

- Controller may, within 30 days, export all Personal Data through the Antarix self-service export tools in a structured, machine-readable format
- After that 30-day window, Processor shall delete all Personal Data from production systems within 90 days and from backups within 150 days, except where retention is required by applicable law
- Processor shall provide written certification of deletion on request
- Anonymized, aggregated data that cannot be linked back to a Data Subject may be retained indefinitely

## 14. Liability

The Parties' total aggregate liability under or in connection with this DPA is subject to the limitation of liability set out in the Agreement, except where Applicable Data Protection Law provides otherwise.

## 15. Order of precedence

In the event of a conflict between this DPA and the Standard Contractual Clauses, the SCCs prevail. In the event of a conflict between this DPA and the Agreement, this DPA prevails with respect to the processing of Personal Data.

## 16. Governing law and jurisdiction

This DPA is governed by the laws of the jurisdiction specified in the Agreement. Disputes are resolved in the courts specified in the Agreement, except that disputes solely concerning the Standard Contractual Clauses are resolved in accordance with Clause 18 of the SCCs.

## 17. Signatures

**For Antarix (Processor):**

Name: ___________________________
Title: ___________________________
Date: ___________________________

**For {{PARTY_NAME}} (Controller):**

Name: ___________________________
Title: ___________________________
Date: ___________________________

---

## Annex A — Technical and Organisational Measures

Processor implements the following measures, consistent with GDPR Art 32:

1. **Confidentiality.** Role-based access control; least-privilege service-role keys; mandatory SSO + MFA for all personnel with production access
2. **Integrity.** TLS 1.2+ in transit; AES-256 at rest; database constraints, CHECKs, and partial unique indexes documented in `supabase/migrations/`
3. **Availability.** Multi-region read replicas for `eu-central-1` and Mumbai; documented incident-response runbook; status page
4. **Resilience.** Daily encrypted backups with 35-day rolling retention; documented restore procedure; quarterly restore drill
5. **Access control.** Audit logging of administrative actions, retained for 24 months
6. **Privacy by design.** Privacy-first aggregates (opted-out students are not enumerable); RLS at the database for all candidate-profile reads; documented data-minimisation in the AI Act disclosure
7. **Sub-processor management.** Written DPAs with all Sub-processors; sub-processor list published and updated with 30-day notice
8. **Breach response.** Documented incident-response plan with 48-hour Processor-to-Controller notification SLA and 72-hour regulator-notification commitment
9. **Vulnerability management.** Dependency scanning in CI; annual third-party penetration test
10. **Personnel.** Confidentiality commitments binding all personnel; annual security and privacy training

## Annex B — Standard Contractual Clauses particulars (Module Two / Module Three)

The Parties complete the data-export particulars as follows. Multiple Modules may be ticked where Controller is itself a processor.

**Module:** ☒ Module Two (Controller → Processor) ☐ Module Three (Processor → Sub-processor)

**Parties.**

- **Data exporter:** {{PARTY_NAME}}, {{PARTY_ADDRESS}}, contact: {{PARTY_DPO_CONTACT}}
- **Data importer:** Antarix, address: TBD <!-- TODO: insert Antarix registered address -->, contact: `privacy@antarix.app`

**Competent Supervisory Authority.** The Supervisory Authority of the data exporter's place of establishment, or such other authority as set out in Clause 13 of the SCCs.

**Categories of Data Subjects.** Students registered on the Antarix platform and their authorised representatives.

**Categories of Personal Data.** See §3 above.

**Sensitive data.** None. (Tick "the personal data transferred do not include sensitive data" in Annex I, Section B.)

**Frequency.** Continuous, for the term of the Agreement.

**Nature of processing.** Storage, hosting, retrieval, analysis, transformation, transmission, and deletion via the Antarix platform.

**Purpose.** Delivery of the Services as described in the Agreement and the Antarix Privacy Notice.

**Period of retention.** See §6 of the Antarix Privacy Notice and §13 of this DPA.

**Onward transfers (Sub-processors).** See [Sub-processor List](sub-processor-list.md).

**Technical and organisational measures.** See Annex A above.

The full text of the SCCs is incorporated by reference. The official current text is published by the European Commission at the URL below. The Parties agree to the latest official text in force on the date of signature of this DPA. <!-- TODO: on the date of signature, replace this comment with the live link to the official SCC text. -->

For transfers from the United Kingdom, the UK International Data Transfer Addendum (issued by the UK ICO) applies with the same effect. <!-- TODO: on the date of signature, replace this comment with the live link to the UK Addendum. -->

## Annex C — Sub-processor list reference

See [Sub-processor List](sub-processor-list.md), incorporated by reference. The current list is maintained at that location and updated in accordance with §9.
