// test-uhin-direct.js
// Run this with: node test-uhin-direct.js
// This tests UHIN connectivity directly without Next.js

const https = require('https');

// UHIN Configuration - Update these with your actual credentials
const UHIN_CONFIG = {
    endpoint: 'https://ws.uhin.org/webservices/core/soaptype4.asmx',
    tradingPartner: 'HT009582-001',
    receiverID: 'HT000004-001',
    username: 'hello@trymoonlit.com',  // Update with real username
    password: 'sT#pt@Jc5ZtSNvR',       // Update with real password
    providerNPI: '1275348807'
};

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Test patient data
const testPatient = {
    firstName: 'JOHN',
    lastName: 'DOE',
    dob: '19850315',  // YYYYMMDD format
    medicaidId: '123456789'
};

// Generate test X12 270
function generateTestX12() {
    const date = new Date();
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
    const timeStr = date.toTimeString().slice(0, 5).replace(':', '');
    const controlNumber = Date.now().toString().slice(-9);

    return [
        `ISA*00*          *00*          *ZZ*${UHIN_CONFIG.tradingPartner.padEnd(15, ' ')}*ZZ*${UHIN_CONFIG.receiverID.padEnd(15, ' ')}*${dateStr}*${timeStr}*^*00501*${controlNumber}*0*P*:~`,
        `GS*HS*${UHIN_CONFIG.tradingPartner}*${UHIN_CONFIG.receiverID}*20${dateStr}*${timeStr}*${controlNumber}*X*005010X279A1~`,
        `ST*270*0001*005010X279A1~`,
        `BHT*0022*13**20${dateStr}*${timeStr}~`,
        `HL*1**20*1~`,
        `NM1*PR*2*UTAH MEDICAID FFS*****46*${UHIN_CONFIG.receiverID}~`,
        `HL*2*1*21*1~`,
        `NM1*1P*1*MOONLIT PLLC*****XX*${UHIN_CONFIG.providerNPI}~`,
        `HL*3*2*22*0~`,
        `TRN*1*${controlNumber}-MOONLIT*${UHIN_CONFIG.tradingPartner}~`,
        `TRN*1*${controlNumber}*9MOONLIT*REALTIME~`,
        `NM1*IL*1*${testPatient.lastName}*${testPatient.firstName}****MI*${testPatient.medicaidId}~`,
        `DMG*D8*${testPatient.dob}~`,
        `DTP*291*RD8*20${dateStr}-20${dateStr}~`,
        `EQ*30~`,
        `SE*14*0001~`,
        `GE*1*${controlNumber}~`,
        `IEA*1*${controlNumber.padStart(9, '0')}~`
    ].join('');
}

// Create SOAP envelope
function createSOAPEnvelope(x12Content, payloadID) {
    const timestamp = new Date().toISOString();

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" 
               xmlns:cor="http://www.caqh.org/SOAP/WSDL/CORERule2.2.0.xsd">
    <soap:Header>
        <wsse:Security soap:mustUnderstand="true" 
                      xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
            <wsse:UsernameToken wsu:Id="UsernameToken-${Date.now()}" 
                               xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
                <wsse:Username>${UHIN_CONFIG.username}</wsse:Username>
                <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${UHIN_CONFIG.password}</wsse:Password>
            </wsse:UsernameToken>
        </wsse:Security>
    </soap:Header>
    <soap:Body>
        <cor:COREEnvelopeRealTimeRequest>
            <PayloadType>X12_270_Request_005010X279A1</PayloadType>
            <ProcessingMode>RealTime</ProcessingMode>
            <PayloadID>${payloadID}</PayloadID>
            <TimeStamp>${timestamp}</TimeStamp>
            <SenderID>${UHIN_CONFIG.tradingPartner}</SenderID>
            <ReceiverID>${UHIN_CONFIG.receiverID}</ReceiverID>
            <CORERuleVersion>2.2.0</CORERuleVersion>
            <Payload>${x12Content}</Payload>
        </cor:COREEnvelopeRealTimeRequest>
    </soap:Body>
</soap:Envelope>`;
}

// Test the connection
async function testUHINConnection() {
    console.log('🔍 Testing UHIN Connection...\n');
    console.log('Configuration:');
    console.log('  Endpoint:', UHIN_CONFIG.endpoint);
    console.log('  Trading Partner:', UHIN_CONFIG.tradingPartner);
    console.log('  Username:', UHIN_CONFIG.username);
    console.log('  Password:', UHIN_CONFIG.password.substring(0, 3) + '***\n');

    const x12 = generateTestX12();
    const payloadID = generateUUID();
    const soapEnvelope = createSOAPEnvelope(x12, payloadID);

    console.log('📝 Generated PayloadID:', payloadID);
    console.log('📝 X12 Length:', x12.length);
    console.log('📝 SOAP Envelope Length:', soapEnvelope.length);
    console.log('\n📡 Sending request to UHIN...\n');

    const url = new URL(UHIN_CONFIG.endpoint);

    const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'SOAPAction': 'http://www.caqh.org/SOAP/WSDL/CORERule2.2.0.xsd/COREEnvelopeRealTimeRequest',
            'Content-Length': Buffer.byteLength(soapEnvelope)
        }
    };

    const req = https.request(options, (res) => {
        console.log('📡 Response Status:', res.statusCode, res.statusMessage);
        console.log('📡 Response Headers:', res.headers);
        console.log('');

        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('📡 Response Body (first 1000 chars):');
            console.log(data.substring(0, 1000));
            console.log('\n');

            // Parse for errors
            if (data.includes('ErrorCode')) {
                const errorMatch = data.match(/<ErrorCode>(.*?)<\/ErrorCode>/);
                const messageMatch = data.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/);

                console.log('❌ ERROR DETECTED:');
                console.log('  Code:', errorMatch ? errorMatch[1] : 'Unknown');
                console.log('  Message:', messageMatch ? messageMatch[1] : 'Unknown');
            } else if (data.includes('Payload') && !data.includes('<Payload/>')) {
                console.log('✅ SUCCESS! Received X12 271 response');
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Request Error:', error);
    });

    req.write(soapEnvelope);
    req.end();
}

// Run the test
testUHINConnection();