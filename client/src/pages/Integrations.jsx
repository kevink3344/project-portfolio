import { useEffect, useState } from 'react';

export default function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/integrations')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load integrations');
        return res.json();
      })
      .then((data) => setIntegrations(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="text-gray-400 dark:text-gray-500 animate-pulse">Loading integrations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center py-24">
        <span className="text-red-500">{error}</span>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-gray-400 dark:text-gray-500">
        <p className="text-lg font-medium">No integrations yet</p>
        <p className="text-sm">Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Integrations</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Technologies and platforms we integrate with
        </p>
      </div>

      <div className="grid gap-6">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="flex gap-6 items-start p-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
          >
            <div className="flex-shrink-0">
              <img
                src={integration.iconUrl}
                alt={integration.title}
                className="w-32 h-32 object-contain rounded-lg bg-gray-50 dark:bg-gray-700"
              />
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                {integration.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {integration.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
