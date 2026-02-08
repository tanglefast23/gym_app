export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-4 text-6xl">📡</div>
      <h1 className="mb-2 text-2xl font-bold text-text-primary">
        You&apos;re Offline
      </h1>
      <p className="text-text-secondary">
        Don&apos;t worry — your workout data is saved locally.
        Reconnect to the internet to continue browsing.
      </p>
    </div>
  );
}
