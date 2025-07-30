// Create a temporary test file: src/app/test-tailwind/page.tsx
export default function TailwindTest() {
    return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
            <div className="moonlit-card">
                <h1 className="text-3xl font-bold text-slate-800 mb-4">
                    Tailwind CSS 3.x Test
                </h1>

                {/* Test Moonlit brand colors */}
                <div className="space-y-4">
                    <button className="btn-primary">
                        Primary Button (Moonlit Coral)
                    </button>

                    <button className="btn-secondary">
                        Secondary Button
                    </button>

                    <div className="bg-moonlit-coral text-white p-4 rounded-md">
                        Custom Moonlit Coral Color
                    </div>

                    <input
                        type="text"
                        placeholder="Test form input styling"
                        className="form-input"
                    />
                </div>

                {/* Grid test */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="bg-orange-100 p-4 rounded-md">Grid Item 1</div>
                    <div className="bg-orange-200 p-4 rounded-md">Grid Item 2</div>
                </div>
            </div>
        </div>
    )
}