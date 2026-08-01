export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse px-4 py-10">
      <div className="h-8 w-40 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-56 rounded bg-gray-100" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded border bg-gray-50" />
        ))}
      </div>
    </main>
  );
}
