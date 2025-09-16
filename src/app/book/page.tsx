// Hard server redirect to Bubble booking page
import { redirect } from 'next/navigation'

export default function BookPage() {
  redirect('https://booknow.trymoonlit.com')
}