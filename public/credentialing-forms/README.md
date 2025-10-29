# Credentialing Forms Directory

This directory stores PDF forms, Excel templates, and other documents required for provider credentialing with various payers.

## Current Forms Needed:

### PDF Forms:
- `selecthealth-provider-application.pdf` - SelectHealth credentialing application
- `hmhi-bhn-provider-application.pdf` - HMHI BHN credentialing application
- `regence-provider-application.pdf` - Regence BCBS credentialing application
- `health-choice-utah-provider-application.pdf` - Health Choice Utah credentialing application

### Excel Forms:
- `molina-provider-roster.xlsx` - Molina provider roster spreadsheet template

## File Organization:

- Files should be named consistently: `{payer-slug}-{form-type}.{ext}`
- Use lowercase with hyphens for payer names
- Keep file names descriptive but concise

## Usage:

These forms are referenced in the `payer_credentialing_workflows` table via the `form_template_url` field.

Forms are accessible to:
- Admins in the credentialing dashboard
- Future: Providers if they need to complete their own credentialing

## Adding New Forms:

1. Upload form file to this directory
2. Update the corresponding `payer_credentialing_workflows` record:
   - Set `form_template_filename`
   - Set `form_template_url` to `/credentialing-forms/{filename}`
3. Test download link in credentialing task view
