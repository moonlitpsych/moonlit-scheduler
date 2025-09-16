"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichPayerWithStatus = enrichPayerWithStatus;
function enrichPayerWithStatus(payer) {
    const today = new Date();
    const effectiveDate = payer.effective_date ? new Date(payer.effective_date) : null;
    const projectedDate = payer.projected_effective_date ? new Date(payer.projected_effective_date) : null;
    let acceptanceStatus;
    let statusMessage;
    if (payer.status_code === 'Approved' &&
        effectiveDate &&
        effectiveDate <= today) {
        acceptanceStatus = 'active';
        statusMessage = "We're in network with your payer.";
        if (payer.requires_attending) {
            statusMessage += " All appointments will be supervised by our attending physician.";
        }
    }
    else if (payer.status_code === 'Approved' &&
        effectiveDate &&
        effectiveDate > today) {
        acceptanceStatus = 'future';
        statusMessage = `We'll be in network starting ${effectiveDate.toLocaleDateString()}.`;
    }
    else if (projectedDate &&
        projectedDate > today &&
        ['Waiting on them', 'In progress'].includes(payer.status_code || '')) {
        acceptanceStatus = 'future';
        statusMessage = `We're working to accept this insurance by ${projectedDate.toLocaleDateString()}.`;
    }
    else if (['Waiting on them', 'In progress'].includes(payer.status_code || '')) {
        acceptanceStatus = 'future';
        statusMessage = "We're working to get in network with this payer. Join our waitlist!";
    }
    else {
        acceptanceStatus = 'not-accepted';
        switch (payer.status_code) {
            case 'X Denied or perm. blocked':
                statusMessage = "This payer doesn't accept new providers currently, but you can join our waitlist.";
                break;
            case 'Blocked':
                statusMessage = "We're temporarily unable to accept this insurance. Join our waitlist for updates.";
                break;
            case 'On pause':
                statusMessage = "We've paused credentialing with this payer. Join our waitlist for updates.";
                break;
            case 'Not started':
                statusMessage = "We haven't started credentialing with this payer yet. Join our waitlist!";
                break;
            default:
                statusMessage = "We don't currently accept this insurance, but you can join our waitlist.";
        }
    }
    return { ...payer, acceptanceStatus, statusMessage };
}
