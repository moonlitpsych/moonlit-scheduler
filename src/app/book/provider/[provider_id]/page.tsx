// Hard server redirect to Bubble booking page
import { redirect } from 'next/navigation'

export default function ProviderSpecificBookingPage() {
  redirect('https://booknow.trymoonlit.com/see_a_psychiatrist')
}