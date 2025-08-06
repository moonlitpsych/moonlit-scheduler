export default function TestDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-[#091747]">Dashboard Test Page</h1>
      <p className="mt-4 text-stone-600">If you can see this, the basic routing works!</p>
      <div className="mt-8 p-4 bg-green-100 border border-green-200 rounded-lg">
        <p className="text-green-800">✅ Dashboard route is working</p>
        <p className="text-green-800">✅ Components are loading</p>
        <p className="text-green-800">✅ Styling is applied</p>
      </div>
    </div>
  )
}