export function LocalBusinessStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": "https://booking.trymoonlit.com/#organization",
    "name": "Moonlit Psychiatry",
    "description": "Telehealth psychiatry practice serving Utah and Idaho. MD/DO physicians only. In-network with HMHI-BHN, Regence, SelectHealth, and Medicaid.",
    "url": "https://booking.trymoonlit.com",
    "telephone": "+1-385-246-2522",
    "email": "hello@trymoonlit.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "1336 S 1100 E",
      "addressLocality": "Salt Lake City",
      "addressRegion": "UT",
      "postalCode": "84105",
      "addressCountry": "US"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 40.7488,
      "longitude": -111.8579
    },
    "areaServed": [
      {
        "@type": "State",
        "name": "Utah"
      },
      {
        "@type": "State",
        "name": "Idaho"
      }
    ],
    "medicalSpecialty": "Psychiatry",
    "availableService": [
      {
        "@type": "MedicalProcedure",
        "name": "Psychiatric Evaluation",
        "procedureType": "https://schema.org/DiagnosticProcedure"
      },
      {
        "@type": "MedicalProcedure",
        "name": "Medication Management",
        "procedureType": "https://schema.org/TherapeuticProcedure"
      }
    ],
    "isAcceptingNewPatients": true,
    "paymentAccepted": [
      "Cash",
      "Credit Card",
      "Insurance"
    ],
    "insuranceAccepted": [
      "HMHI-BHN",
      "Regence Blue Cross Blue Shield",
      "University of Utah Health Plans",
      "SelectHealth",
      "Medicaid",
      "DMBA"
    ],
    "openingHours": "Mo-Su",
    "priceRange": "$$"
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
