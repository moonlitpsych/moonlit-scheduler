'use client'

export default function AdminProviderList({ providers }: any) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Provider List (Admin Dashboard)</h2>
      <p className="text-gray-600">Dashboard components are being developed. The main booking system is fully functional!</p>
      {providers?.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">{providers.length} providers found</p>
        </div>
      )}
    </div>
  )
}