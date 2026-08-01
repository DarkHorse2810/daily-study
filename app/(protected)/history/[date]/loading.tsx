export default function HistoryDateLoading() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse px-4 py-10">
      <div className="h-4 w-24 rounded bg-gray-100" />
      <div className="mt-4 h-6 w-48 rounded bg-gray-200" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded border bg-gray-50" />
        ))}
      </div>
    </main>
  );
}
