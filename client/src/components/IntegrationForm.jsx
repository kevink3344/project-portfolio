import { useEffect, useState } from 'react';

const EMPTY_FORM = {
  title: '',
  description: '',
  iconFile: null,
};

export default function IntegrationForm({ integration, onSave, onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(
    integration
      ? {
          title: integration.title,
          description: integration.description,
          iconFile: null,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [iconPreview, setIconPreview] = useState(integration?.iconUrl || null);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setIsOpen(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setForm((f) => ({ ...f, iconFile: file }));

    const url = URL.createObjectURL(file);
    setIconPreview(url);

    return () => URL.revokeObjectURL(url);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const token = localStorage.getItem('adminToken');
    const method = integration ? 'PUT' : 'POST';
    const url = integration ? `/api/integrations/${integration.id}` : '/api/integrations';

    const formData = new FormData();
    formData.append('title', form.title);
    formData.append('description', form.description);
    if (form.iconFile) {
      formData.append('icon', form.iconFile);
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      <aside
        className={`absolute inset-y-0 right-0 w-full max-w-2xl border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl transform-gpu transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {integration ? 'Edit Integration' : 'New Integration'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-4 text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                id="title"
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g., React"
                required
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe this integration…"
                required
                disabled={saving}
                rows={4}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50 resize-none"
              />
            </div>

            <div>
              <label htmlFor="icon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icon {integration && '(Optional)'}
              </label>
              <input
                id="icon"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={saving}
                required={!integration}
                className="block w-full text-sm text-gray-500 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100"
              />
              {iconPreview && (
                <div className="mt-4">
                  <img
                    src={iconPreview}
                    alt="Icon preview"
                    className="w-24 h-24 object-contain rounded-lg bg-gray-100 dark:bg-gray-800"
                  />
                </div>
              )}
            </div>
          </form>

          <div className="flex gap-3 items-center justify-end border-t border-gray-200 dark:border-gray-700 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
