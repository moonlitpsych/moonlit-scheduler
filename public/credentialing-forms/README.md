# Credentialing Forms Directory

This directory stores PDF and Excel templates for payer credentialing workflows.

## Current Forms Needed

Based on the credentialing workflows configured in the database:

1. **Health Choice Utah**
   - File: `health-choice-utah-provider-application.pdf`
   - Contact: Amy Prince (Amy.Prince@healthchoiceutah.com)

2. **SelectHealth Integrated**
   - File: `selecthealth-provider-application.pdf`
   - Contact: Brittany Reynolds (Brittany.Reynolds@selecthealth.org)

3. **HMHI BHN**
   - File: `hmhi-bhn-provider-application.pdf`
   - Contact: Jessie Konate (jessie.konate@hsc.utah.edu)

4. **Regence BlueCross BlueShield**
   - File: `regence-provider-application.pdf`
   - Contact: General credentialing email

5. **Molina Utah**
   - File: `molina-provider-roster.xlsx`
   - Contact: MHU PIM Team (MHUPIM@molinahealthcare.com)

## How to Add Forms

1. Place the PDF or Excel file in this directory
2. Use the exact filename listed above
3. Forms will automatically be available for download in the credentialing task UI

## Re-enabling Form Downloads

Once files are added, uncomment the form download section in:
- `src/components/admin/CredentialingTaskList.tsx` (lines 292-306)

The code is already configured to serve these files - just add the actual files and uncomment the UI section.

## File Paths in Database

The database stores relative paths like:
- `/credentialing-forms/selecthealth-provider-application.pdf`

Next.js automatically serves files from `/public` at the root URL path.
