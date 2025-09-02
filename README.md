# Moonlit Scheduler

A professional healthcare booking system built for Moonlit Psychiatry. This Next.js 15 application provides a complete patient booking platform with provider management, insurance validation, and EMR integration.

## 🌟 Features

- **Professional Homepage** with patient testimonials and provider directory
- **Dual-Intent Booking System** ("Book Now" vs "See Availability" flows)
- **Provider-Specific Booking** with SEO-friendly URLs
- **Real-Time Availability** with double-booking prevention
- **Insurance Validation** and mismatch handling
- **IntakeQ EMR Integration** for appointment management
- **Ways to Pay Directory** with live insurance data and search
- **Mobile-Responsive Design** with brand-consistent styling
- **Provider Dashboard** with availability management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account and database
- Environment variables (see `.env.example`)

### Installation

```bash
# Clone the repository
git clone https://github.com/moonlitpsych/moonlit-scheduler.git
cd moonlit-scheduler

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your actual values

# Run development server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to view the application.

## 🏗️ Tech Stack

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Database**: Supabase PostgreSQL with Row Level Security
- **Authentication**: Supabase Auth
- **EMR Integration**: IntakeQ API
- **Email**: Resend API
- **Deployment**: Vercel
- **Icons**: Lucide React

## 🎨 Brand Guidelines

### Colors
- **Navy**: `#091747` - Primary text and headings
- **Brown**: `#BF9C73` - Buttons and accents  
- **Cream**: `#FEF8F1` - Background
- **Orange**: `#E67A47` - Secondary accent

### Typography
- **Font Family**: Newsreader (serif)
- **Weight**: Light (300-400) for headings, Regular (400) for body text

## 📁 Project Structure

```
src/
├── app/                    # Next.js 15 App Router pages and API routes
│   ├── api/               # Backend API endpoints
│   ├── book/              # Booking flow pages
│   ├── practitioners/     # Provider directory
│   └── ways-to-pay/       # Insurance directory
├── components/            # React components
│   ├── booking/          # Booking flow components
│   ├── layout/           # Header, Footer, Navigation
│   ├── providers/        # Provider dashboard components
│   └── shared/           # Reusable UI components
├── contexts/             # React Context providers
├── lib/                  # Utilities and services
│   └── services/         # Business logic services
├── types/                # TypeScript type definitions
└── utils/                # Helper functions
```

## 🔧 Environment Variables

Required environment variables (add to `.env.local`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# IntakeQ (optional - EMR integration)
INTAKEQ_API_KEY=your_intakeq_key

# Email (optional - notifications)
RESEND_API_KEY=your_resend_key
FROM_EMAIL=noreply@yourdomain.com
```

## 📊 Key Features

### Booking System
- **Multi-scenario booking**: Self, third-party, and case manager flows
- **Provider selection**: Browse all providers or book specific doctors
- **Insurance validation**: Real-time insurance acceptance checking
- **Conflict prevention**: Double-booking prevention with live availability
- **Mobile responsive**: Touch-friendly interface for all devices

### Provider Management
- **Dashboard**: Availability management and appointment overview
- **Profile system**: Provider information and specialties
- **Modal system**: Global provider detail modals with booking integration

### Database Architecture
- **Providers**: Doctor information, specialties, availability
- **Payers**: Insurance companies and self-pay options
- **Appointments**: Booking records with EMR sync
- **Users**: Authentication and role management

## 🧪 Testing

```bash
# Run tests
npm test

# Build and test production
npm run build
npm start

# Lint code
npm run lint
```

## 🚀 Deployment

The application is deployed on Vercel with automatic deployments from the `main` branch.

### Manual Deployment
```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

## 📚 Documentation

- **Development History**: See `CLAUDE.md` for detailed development log
- **API Documentation**: API routes in `/src/app/api/`
- **Component Guide**: Component documentation in source files

## 🛠️ Development

### Branch Strategy
- `main`: Production-ready code
- `feature/*`: Feature development branches
- Always create PRs for main branch changes

### Code Style
- TypeScript strict mode
- ESLint and Prettier configuration
- Consistent naming conventions
- Brand-compliant styling

## 🔒 Security

- Row Level Security (RLS) on all database tables
- Environment variable validation
- Input sanitization on API routes
- Secure authentication flows

## 📞 Support

For development questions or issues:
- Check `CLAUDE.md` for detailed implementation notes
- Review API error logs in development console
- Contact: hello@trymoonlit.com

---

**Built with ❤️ for Moonlit Psychiatry**