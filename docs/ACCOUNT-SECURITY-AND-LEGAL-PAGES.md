# AARPIVA account security and legal pages

This release adds forgot-password via Brevo OTP, authenticated password changes for customers and admins, Terms & Conditions / Privacy Policy acceptance at registration, Contact details, Privacy Policy and Terms & Conditions pages, and removal of the unused footer newsletter block.

No new Render secret is required. The API creates the password-reset OTP table and legal-consent columns at startup; an optional manual SQL upgrade is in `database/upgrade-account-security-and-legal.sql`.

Contact details used on the website:
- Nilesh Barman
- aarpiva1801@gmail.com
- +91 76058 05775

The legal pages are general templates based on the current AARPIVA features and the applicable Indian ecommerce/privacy framework. Before relying on them as final legal documents, confirm the exact legal entity name, registered business address, grievance-officer designation, refund/return terms and any tax/licensing disclosures applicable to the operating business.
