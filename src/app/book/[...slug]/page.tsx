// Hard server redirect to Bubble booking page - catch all /book/* routes
import { redirect } from 'next/navigation'

export default function BookCatchAllPage() {
  redirect('https://booknow.trymoonlit.com')
}